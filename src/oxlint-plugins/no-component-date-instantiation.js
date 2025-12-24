import { defineRule } from "oxlint";

/**
 * @typedef {import("oxlint").Context} RuleContext
 * @typedef {import("oxlint").ESTree.Node} ESTNode
 * @typedef {import("oxlint").ESTree.NewExpression} NewExpressionNode
 * @typedef {import("oxlint").ESTree.ReturnStatement} ReturnStatementNode
 * @typedef {import("oxlint").ESTree.Function | import("oxlint").ESTree.ArrowFunctionExpression} FunctionLikeNode
 */

/**
 * @typedef {object} FunctionContext
 * @property {FunctionLikeNode} node
 * @property {FunctionContext | null} parent
 * @property {string} name
 * @property {boolean} returnsJsx
 * @property {NewExpressionNode[]} dateInstantiations
 */

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
 * Check if a function name follows React component naming convention (PascalCase)
 * @param {unknown} name
 * @returns {name is string}
 */
const isComponentName = (name) => typeof name === "string" && /^[A-Z]/.test(name);

/**
 * Get the name of a function node
 * @param {FunctionLikeNode} node
 * @returns {string}
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

  if (parent.type === "Property" || parent.type === "MethodDefinition") {
    return parent.key && parent.key.type === "Identifier" ? parent.key.name : "";
  }

  return "";
};

/**
 * Check if a node is a JSX element or fragment
 * @param {ESTNode | null | undefined} node
 * @returns {boolean}
 */
const isJSXNode = (node) => {
  if (!node || !isNode(node)) return false;
  return node.type === "JSXElement" || node.type === "JSXFragment";
};

/**
 * Check if a NewExpression is creating a Date instance
 * @param {NewExpressionNode} node
 * @returns {boolean}
 */
const isDateInstantiation = (node) => {
  if (node.callee.type === "Identifier" && node.callee.name === "Date") {
    return true;
  }
  return false;
};

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Date instantiation in the top scope of React components. Date instances declared on every render are bad because they change every render.",
      recommended: true,
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
      const parent = currentFunction();
      /** @type {FunctionContext} */
      const fnCtx = {
        node,
        parent,
        name: getFunctionName(node),
        returnsJsx: false,
        dateInstantiations: [],
      };

      functionStack.push(fnCtx);

      // Check for arrow functions with expression body that returns JSX
      if (node.type === "ArrowFunctionExpression" && node.body && node.body.type !== "BlockStatement") {
        if (isJSXNode(node.body)) {
          fnCtx.returnsJsx = true;
        }
      }
    };

    const exitFunction = () => {
      const fnCtx = functionStack.pop();
      if (!fnCtx) return;

      // Only report if this is a React component (PascalCase name + returns JSX)
      if (!fnCtx.returnsJsx) return;
      if (!isComponentName(fnCtx.name)) return;

      // Report all Date instantiations in the top scope of this component
      for (const dateNode of fnCtx.dateInstantiations) {
        context.report({
          node: dateNode,
          message: `Avoid instantiating Date in the top scope of component '${fnCtx.name}'. Date instances change on every render. Move it inside an effect, event handler, or use useMemo/useCallback.`,
        });
      }
    };

    /** @param {ReturnStatementNode} node */
    const handleReturnStatement = (node) => {
      const fnCtx = currentFunction();
      if (!fnCtx) return;

      const argument = node.argument;
      if (!argument) return;

      if (isJSXNode(argument)) {
        fnCtx.returnsJsx = true;
      }
    };

    /** @param {NewExpressionNode} node */
    const handleNewExpression = (node) => {
      if (!isDateInstantiation(node)) return;

      const fnCtx = currentFunction();
      if (!fnCtx) return;

      // Record this Date instantiation - we'll check if it's in top scope when the function exits
      fnCtx.dateInstantiations.push(node);
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
      NewExpression(node) {
        if (node.type === "NewExpression") handleNewExpression(node);
      },
    });
  },
});

export const noComponentDateInstantiationRule = rule;

