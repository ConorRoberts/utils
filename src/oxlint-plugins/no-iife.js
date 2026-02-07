import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Immediately Invoked Function Expressions (IIFE)",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} node
       */
      CallExpression(node) {
        if (node.type !== "CallExpression") return;

        const { callee } = node;

        // Check if callee is a FunctionExpression or ArrowFunctionExpression
        if (callee.type === "FunctionExpression" || callee.type === "ArrowFunctionExpression") {
          context.report({
            node,
            message:
              "Immediately Invoked Function Expressions (IIFE) are disallowed. Use a regular function declaration or block scope instead.",
          });
        }
      },
    });
  },
});

export const noIifeRule = rule;
