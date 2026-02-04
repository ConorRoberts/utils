import { defineRule } from "oxlint/plugins";

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Array<T> type syntax in favor of T[] syntax",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return {
      TSTypeReference(node) {
        if (node.type !== "TSTypeReference") return;

        // Check if this is an Array type reference
        if (node.typeName?.type === "Identifier" && node.typeName.name === "Array" && node.typeParameters) {
          context.report({
            node,
            message: "Use T[] syntax instead of Array<T>",
          });
        }
      },
    };
  },
});

export const noArrayTypeRule = rule;
