import { defineRule } from "oxlint/plugins";

/**
 * @typedef {import("oxlint/plugins").Context} RuleContext
 * @typedef {import("oxlint/plugins").ESTree.Node} ESTNode
 * @typedef {import("oxlint/plugins").ESTree.Expression} ESTExpression
 * @typedef {import("oxlint/plugins").ESTree.ReturnStatement} ReturnStatementNode
 * @typedef {import("oxlint/plugins").ESTree.Function | import("oxlint/plugins").ESTree.ArrowFunctionExpression} FunctionLikeNode
 */

/**
 * @typedef {object} FunctionContext
 * @property {FunctionLikeNode} node
 * @property {string} name
 * @property {boolean} returnsJsx
 */

const JSX_NODE_TYPES = new Set(["JSXElement", "JSXFragment"]);
const FUNCTION_NODE_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/**
 * @param {unknown} node
 * @returns {node is ESTNode & { type: string }}
 */
const isNode = (node) => Boolean(node && typeof node === "object" && "type" in node);

/**
 * @param {unknown} node
 * @returns {node is FunctionLikeNode}
 */
const isFunctionLike = (node) => isNode(node) && FUNCTION_NODE_TYPES.has(node.type);

/**
 * @param {unknown} name
 * @returns {name is string}
 */
const isPascalCase = (name) => typeof name === "string" && /^[A-Z]/.test(name);

/**
 * Check if a name is a valid higher-order component name (starts with "with")
 * @param {unknown} name
 * @returns {name is string}
 */
const isHOCName = (name) => typeof name === "string" && /^with[A-Z]/.test(name);

/**
 * @param {FunctionLikeNode} node
 */
const getFunctionName = (node) => {
  if (node.type === "FunctionDeclaration" && node.id && node.id.type === "Identifier") {
    return node.id.name;
  }

  if ((node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && node.id) {
    if (node.id.type === "Identifier") return node.id.name;
  }

  const parent = node.parent;
  if (!parent || !isNode(parent)) return "";

  if (parent.type === "VariableDeclarator") {
    return parent.id && parent.id.type === "Identifier" ? parent.id.name : "";
  }

  if (parent.type === "AssignmentExpression") {
    return parent.left && parent.left.type === "Identifier" ? parent.left.name : "";
  }

  // Don't enforce naming for functions used as object property values or JSX props
  // These are often callbacks or configuration options, not standalone components
  if (parent.type === "Property" || parent.type === "MethodDefinition") {
    return "";
  }

  // Handle functions passed as arguments to calls (e.g., useCallback, useMemo)
  if (parent.type === "CallExpression") {
    const callParent = parent.parent;
    if (callParent && isNode(callParent)) {
      if (callParent.type === "VariableDeclarator") {
        return callParent.id && callParent.id.type === "Identifier" ? callParent.id.name : "";
      }
      if (callParent.type === "AssignmentExpression") {
        return callParent.left && callParent.left.type === "Identifier" ? callParent.left.name : "";
      }
    }
  }

  return "";
};

/**
 * @param {ESTExpression | null | undefined} root
 */
const expressionContainsJsx = (root) => {
  if (!root || !isNode(root)) return false;

  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isNode(current)) continue;

    if (JSX_NODE_TYPES.has(current.type)) {
      return true;
    }

    if (FUNCTION_NODE_TYPES.has(current.type) && current !== root) {
      continue;
    }

    for (const key of Object.keys(current)) {
      if (key === "parent") continue;

      const value = current[key];
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const element of value) {
          if (isNode(element)) {
            stack.push(element);
          }
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }

  return false;
};

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Enforce PascalCase naming for functions that return JSX elements (components).",
      recommended: false,
    },
    schema: [],
  },

  createOnce(context) {
    /** @type {FunctionContext[]} */
    const functionStack = [];

    const currentFunction = () => functionStack[functionStack.length - 1] ?? null;

    /**
     * @param {FunctionLikeNode} node
     */
    const enterFunction = (node) => {
      const name = getFunctionName(node);

      /** @type {FunctionContext} */
      const fnCtx = {
        node,
        name,
        returnsJsx: false,
      };

      functionStack.push(fnCtx);

      if (node.type === "ArrowFunctionExpression" && node.body && node.body.type !== "BlockStatement") {
        if (expressionContainsJsx(node.body)) {
          fnCtx.returnsJsx = true;
        }
      }
    };

    const exitFunction = () => {
      const fnCtx = functionStack.pop();
      if (!fnCtx) return;

      // Allow PascalCase or HOC naming (withXxx)
      if (fnCtx.returnsJsx && fnCtx.name && !isPascalCase(fnCtx.name) && !isHOCName(fnCtx.name)) {
        context.report({
          node: fnCtx.node,
          message: `Function '${fnCtx.name}' returns JSX and should use PascalCase naming (e.g., '${fnCtx.name.charAt(0).toUpperCase()}${fnCtx.name.slice(1)}').`,
        });
      }
    };

    /** @param {ReturnStatementNode} node */
    const handleReturnStatement = (node) => {
      const fnCtx = currentFunction();
      if (!fnCtx) return;

      const argument = node.argument;
      if (!argument || isFunctionLike(argument)) return;

      if (expressionContainsJsx(argument)) {
        fnCtx.returnsJsx = true;
      }
    };

    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      FunctionDeclaration(node) {
        if (isFunctionLike(node)) enterFunction(node);
      },
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression(node) {
        if (isFunctionLike(node)) enterFunction(node);
      },
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression(node) {
        if (isFunctionLike(node)) enterFunction(node);
      },
      "ArrowFunctionExpression:exit": exitFunction,
      ReturnStatement(node) {
        if (node.type === "ReturnStatement") handleReturnStatement(node);
      },
    });
  },
});

export const jsxComponentPascalCaseRule = rule;
