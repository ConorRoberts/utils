import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

export const noSwitchRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow switch/case statements",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} node
       */
      SwitchStatement(node) {
        if (node.type !== "SwitchStatement") return;

        context.report({
          node,
          message: "Use of switch/case is disallowed. Use object map or if/else instead.",
        });
      },
    });
  },
});
