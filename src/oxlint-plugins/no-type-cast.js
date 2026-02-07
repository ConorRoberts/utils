import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow TypeScript type assertions (`as` and angle-bracket syntax) to prevent unsafe type casting.",
      recommended: false,
    },
    schema: [],
  },

  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} rawNode
       */
      TSAsExpression(rawNode) {
        if (rawNode.type !== "TSAsExpression") return;

        // Allow "as const" assertions
        if (
          rawNode.typeAnnotation.type === "TSTypeReference" &&
          rawNode.typeAnnotation.typeName.type === "Identifier" &&
          rawNode.typeAnnotation.typeName.name === "const"
        ) {
          return;
        }

        context.report({
          node: rawNode,
          message:
            "Type casting with `as` is not permitted. Use runtime validation with valibot or refactor to avoid type casting.",
        });
      },

      /**
       * @param {ESTNode} rawNode
       */
      TSTypeAssertion(rawNode) {
        if (rawNode.type !== "TSTypeAssertion") return;

        context.report({
          node: rawNode,
          message:
            "Type casting with angle brackets `<Type>` is not permitted. Use runtime validation with valibot or refactor to avoid type casting.",
        });
      },

      /**
       * @param {ESTNode} rawNode
       */
      TSNonNullExpression(rawNode) {
        if (rawNode.type !== "TSNonNullExpression") return;

        context.report({
          node: rawNode,
          message:
            "Non-null assertion operator `!` is not permitted. Handle null/undefined cases explicitly or use optional chaining.",
        });
      },
    });
  },
});

export const noTypeCastRule = rule;
