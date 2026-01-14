import { defineRule } from "oxlint";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `let` keyword everywhere except in for loop initializers.",
      recommended: false,
    },
    schema: [],
  },

  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} rawNode
       */
      VariableDeclaration(rawNode) {
        if (rawNode.type !== "VariableDeclaration") return;
        const node = rawNode;

        if (node.kind !== "let") return;

        // Only allow let in for loop initializers
        const parent = node.parent;
        if (parent) {
          // For traditional for loops, check init property
          if (parent.type === "ForStatement" && parent.init === node) {
            return;
          }
          // For for-in and for-of loops, check left property
          if (
            (parent.type === "ForInStatement" || parent.type === "ForOfStatement") &&
            parent.left === node
          ) {
            return;
          }
        }

        context.report({
          node,
          message:
            "Avoid using `let`; prefer `const` or use `let` only in for loop initializers.",
        });
      },
    });
  },
});

export const noTopLevelLetRule = rule;

