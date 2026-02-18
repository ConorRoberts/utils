import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow using .then() and .catch() on promises. Use async/await instead.",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      CallExpression(node) {
        if (node.type !== "CallExpression") return;

        // Check if this is a method call (e.g., promise.then())
        if (node.callee.type !== "MemberExpression") return;

        const memberExpression = node.callee;

        // Check if the property being called is "then" or "catch"
        if (memberExpression.property.type === "Identifier" && (memberExpression.property.name === "then" || memberExpression.property.name === "catch")) {
          context.report({
            node,
            message: `Avoid using .${memberExpression.property.name}() on promises. Use async/await instead.`,
          });
        }
      },
    });
  },
});

export const noPromiseThenRule = rule;
