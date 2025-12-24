import { defineRule } from "oxlint";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

/**
 * Get the enclosing function node for a given node
 * @param {ESTNode} node
 * @returns {ESTNode | null}
 */
const getEnclosingFunction = (node) => {
  const findFunction = (current) => {
    if (!current) return null;
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return current;
    }
    return findFunction(current.parent);
  };
  return findFunction(node.parent);
};

/**
 * Check if a node is inside a loop
 * @param {ESTNode} node
 * @param {ESTNode} stopAt - Stop searching when we reach this node
 * @returns {boolean}
 */
const isInsideLoop = (node, stopAt) => {
  const checkLoop = (current) => {
    if (!current || current === stopAt) return false;
    if (
      current.type === "ForStatement" ||
      current.type === "ForInStatement" ||
      current.type === "ForOfStatement" ||
      current.type === "WhileStatement" ||
      current.type === "DoWhileStatement"
    ) {
      return true;
    }
    return checkLoop(current.parent);
  };
  return checkLoop(node.parent);
};

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow top-level `let` declarations inside functions to prevent conditional reassignment.",
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

        const fn = getEnclosingFunction(node);
        if (
          !fn ||
          (fn.type !== "FunctionDeclaration" &&
            fn.type !== "FunctionExpression" &&
            fn.type !== "ArrowFunctionExpression")
        ) {
          return;
        }

        const parent = node.parent;
        if (!parent || parent.type !== "BlockStatement" || parent.parent !== fn) return;

        // Allow let declarations inside loops
        if (isInsideLoop(node, fn)) return;

        context.report({
          node,
          message:
            "Avoid using `let` at the top level of functions; prefer `const` with extracted functions to avoid conditional reassignment. Extract conditional logic into a separate function that returns the appropriate value.",
        });
      },
    });
  },
});

export const noTopLevelLetRule = rule;

export default {
  meta: { name: "conorroberts/no-top-level-let" },
  rules: { "conorroberts/no-top-level-let": rule },
};
