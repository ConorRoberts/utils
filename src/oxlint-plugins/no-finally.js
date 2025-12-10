import { defineRule } from "oxlint";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow 'finally' blocks in try/catch/finally statements",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} node
       */
      TryStatement(node) {
        if (node.type !== "TryStatement") return;

        if (node.finalizer) {
          context.report({
            node: node.finalizer,
            message: "Use of 'finally' blocks is disallowed. Handle cleanup explicitly in try/catch blocks instead.",
          });
        }
      },
    });
  },
});

export const noFinallyRule = rule;

export default {
  meta: { name: "no-finally" },
  rules: { "no-finally": rule },
};
