import { defineRule } from "oxlint";

/**
 * @typedef {import("oxlint").Context} RuleContext
 * @typedef {import("oxlint").ESTree.Node} ESTNode
 * @typedef {import("oxlint").ESTree.Expression} ESTExpression
 * @typedef {import("oxlint").ESTree.Function | import("oxlint").ESTree.ArrowFunctionExpression} FunctionLikeNode
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
 * Check if an expression contains JSX
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

/**
 * Check if a function returns JSX
 * @param {FunctionLikeNode} node
 */
const functionReturnsJsx = (node) => {
  // Check arrow functions with expression body
  if (node.type === "ArrowFunctionExpression" && node.body && node.body.type !== "BlockStatement") {
    return expressionContainsJsx(node.body);
  }

  // Check for return statements in function body
  const body = node.body;
  if (!body || body.type !== "BlockStatement") return false;

  const stack = [body];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isNode(current)) continue;

    if (current.type === "ReturnStatement") {
      const argument = current.argument;
      if (argument && expressionContainsJsx(argument)) {
        return true;
      }
    }

    // Don't traverse into nested functions
    if (FUNCTION_NODE_TYPES.has(current.type) && current !== body) {
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
      description: "Enforce consistent props parameter naming and disallow destructuring in component parameters.",
      recommended: false,
    },
    schema: [],
  },

  createOnce(context) {
    /**
     * Check if a node is at the top level of the file (module scope)
     * @param {FunctionLikeNode} node
     * @returns {boolean}
     */
    const isTopLevel = (node) => {
      let current = node.parent;

      while (current && isNode(current)) {
        // If we hit a Program node, we're at the top level
        if (current.type === "Program") {
          return true;
        }

        // FunctionDeclarations at the Program level will have Program as parent
        if (node.type === "FunctionDeclaration" && current.type === "Program") {
          return true;
        }

        // For variable declarations: const MyComponent = () => {}
        // The hierarchy is: ArrowFunction -> VariableDeclarator -> VariableDeclaration -> Program
        if (current.type === "VariableDeclaration") {
          const parent = current.parent;
          if (parent && isNode(parent) && parent.type === "Program") {
            return true;
          }
        }

        // If we encounter a function, we're inside a nested function
        if (FUNCTION_NODE_TYPES.has(current.type)) {
          return false;
        }

        current = current.parent;
      }

      return false;
    };

    /**
     * Check if a function is a top-level React component (PascalCase naming at top level)
     * @param {FunctionLikeNode} node
     * @returns {boolean}
     */
    const isTopLevelReactComponent = (node) => {
      // First check if it's at the top level
      if (!isTopLevel(node)) {
        return false;
      }

      // Check for named functions (FunctionDeclaration, FunctionExpression with id)
      if (node.id?.name) {
        const firstChar = node.id.name.charAt(0);
        return firstChar === firstChar.toUpperCase();
      }

      // For arrow functions and anonymous function expressions, check the parent context
      // to see if they're assigned to a PascalCase variable
      const parent = node.parent;
      if (!parent || !isNode(parent)) {
        return false;
      }

      // Check for variable declarations: const MyComponent = () => {}
      if (parent.type === "VariableDeclarator" && parent.id && "name" in parent.id) {
        const name = parent.id.name;
        if (typeof name === "string") {
          const firstChar = name.charAt(0);
          return firstChar === firstChar.toUpperCase();
        }
      }

      return false;
    };

    /**
     * @param {FunctionLikeNode} node
     */
    const checkFunction = (node) => {
      // Only check functions that return JSX (React components)
      if (!functionReturnsJsx(node)) {
        return;
      }

      // Only check functions that are top-level React components (PascalCase naming at top level)
      if (!isTopLevelReactComponent(node)) {
        return;
      }

      const params = node.params;
      if (!params || params.length === 0) {
        return;
      }

      const firstParam = params[0];
      if (!firstParam || !isNode(firstParam)) {
        return;
      }

      // Check if the first parameter is destructured
      if (firstParam.type === "ObjectPattern" || firstParam.type === "ArrayPattern") {
        context.report({
          node: firstParam,
          message:
            "Props should not be destructured in the component parameter. Use 'props' instead and destructure inside the component body.",
        });
        return;
      }

      // Check if the first parameter is an Identifier and is named 'props'
      if (firstParam.type === "Identifier") {
        if (firstParam.name !== "props") {
          context.report({
            node: firstParam,
            message: `Props parameter should be named 'props', not '${firstParam.name}'.`,
          });
        }
      }
    };

    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      FunctionDeclaration(node) {
        if (isFunctionLike(node)) checkFunction(node);
      },
      FunctionExpression(node) {
        if (isFunctionLike(node)) checkFunction(node);
      },
      ArrowFunctionExpression(node) {
        if (isFunctionLike(node)) checkFunction(node);
      },
    });
  },
});

export const prettyPropsRule = rule;
