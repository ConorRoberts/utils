import { defineRule } from "oxlint";

/**
 * @typedef {import("oxlint").Context} RuleContext
 * @typedef {import("oxlint").ESTree.Node} ESTNode
 * @typedef {import("oxlint").ESTree.JSXExpressionContainer} JSXExpressionContainer
 * @typedef {import("oxlint").ESTree.CallExpression} CallExpression
 */

/**
 * @param {unknown} node
 * @returns {node is ESTNode & { type: string }}
 */
const isNode = (node) => Boolean(node && typeof node === "object" && "type" in node);

/**
 * @param {ESTNode | null | undefined} node
 * @returns {boolean}
 */
const isInJSXExpressionContainer = (node) => {
  const findJSXContainer = (current) => {
    if (!current) return false;
    if (current.type === "JSXExpressionContainer") {
      return true;
    }
    return findJSXContainer(isNode(current) ? current.parent ?? null : null);
  };
  return findJSXContainer(isNode(node) ? node.parent ?? null : null);
};

/**
 * @param {CallExpression} node
 * @returns {string}
 */
const getCalleeName = (node) => {
  const callee = node.callee;
  if (!callee) return "function";

  if (callee.type === "Identifier") {
    return callee.name;
  }

  if (callee.type === "MemberExpression") {
    const property = callee.property;
    if (property && property.type === "Identifier") {
      return property.name;
    }
  }

  return "function";
};

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow function calls within JSX expression containers",
      recommended: false,
    },
    schema: [],
  },

  create(context) {
    /**
     * @param {CallExpression} node
     */
    const handleCallExpression = (node) => {
      if (node.type !== "CallExpression") return;

      if (!isInJSXExpressionContainer(node)) return;

      const calleeName = getCalleeName(node);

      context.report({
        node: node,
        message: `Avoid calling '${calleeName}()' directly in JSX. Store the result in a variable or use a component instead.`,
      });
    };

    return {
      CallExpression: handleCallExpression,
    };
  },
});

export const noFunctionCallInJsxRule = rule;

export default {
  meta: { name: "no-function-call-in-jsx" },
  rules: { "no-function-call-in-jsx": rule },
};
