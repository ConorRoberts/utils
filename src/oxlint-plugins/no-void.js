import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */
/** @typedef {import("oxlint/plugins").ESTree.UnaryExpression} UnaryExpression */

/**
 * The rule is only meant to block the JavaScript runtime `void` operator.
 *
 * TypeScript's `void` type is represented as `TSVoidKeyword`, not `UnaryExpression`,
 * and should remain allowed.
 *
 * @param {ESTNode} node
 * @returns {node is UnaryExpression}
 */
const isRuntimeVoidOperator = (node) => node.type === "UnaryExpression" && node.operator === "void";

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the JavaScript 'void' operator",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} node
       */
      UnaryExpression(node) {
        if (!isRuntimeVoidOperator(node)) return;

        context.report({
          node,
          message: "Use of 'void' operator is disallowed in JavaScript.",
        });
      },

      TSVoidKeyword() {
        // Intentionally allowed: this rule only targets the runtime operator.
      },
    });
  },
});

export const noVoidRule = rule;
