import { defineRule } from "oxlint";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

const noSwitchRule = defineRule({
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

export default {
  meta: {
    name: "no-switch-plugin",
  },
  rules: {
    "no-switch": noSwitchRule,
  },
};
