import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the 'void' operator",
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
        if (node.type !== "UnaryExpression") return;

        if (node.operator === "void") {
          context.report({
            node,
            message: "Use of 'void' operator is disallowed in JavaScript.",
          });
        }
      },
    });
  },
});

export const noVoidRule = rule;
