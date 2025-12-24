import { defineRule } from "oxlint";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the 'delete' operator",
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

        if (node.operator === "delete") {
          context.report({
            node,
            message:
              "Use of 'delete' operator is disallowed. Use object destructuring or set properties to undefined instead.",
          });
        }
      },
    });
  },
});

export const noDeleteRule = rule;
