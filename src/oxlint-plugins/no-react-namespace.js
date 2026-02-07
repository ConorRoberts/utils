import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

/**
 * Check if a MemberExpression is accessing the React namespace
 * @param {ESTNode} node
 * @returns {boolean}
 */
const isReactNamespaceAccess = (node) => {
  if (node.type !== "MemberExpression") return false;

  const object = node.object;
  if (!object || object.type !== "Identifier" || object.name !== "React") {
    return false;
  }

  return true;
};

/**
 * Check if this is a type annotation context (TypeScript)
 * @param {ESTNode} node
 * @returns {boolean}
 */
const isTypeContext = (node) => {
  const checkParent = (current) => {
    if (!current) return false;

    // Type annotation contexts where React namespace is allowed
    const typeContextTypes = new Set([
      "TSTypeReference",
      "TSTypeAnnotation",
      "TSTypeParameterInstantiation",
      "TSInterfaceHeritage",
      "TSTypeQuery",
      "TSTypeAliasDeclaration",
      "TSInterfaceDeclaration",
      "TSTypeLiteral",
      "TSPropertySignature",
      "TSIndexSignature",
      "TSMethodSignature",
      "TSCallSignatureDeclaration",
      "TSConstructSignatureDeclaration",
      "TSExpressionWithTypeArguments",
    ]);

    if (typeContextTypes.has(current.type)) {
      return true;
    }

    // Stop at statement or expression boundaries
    if (
      current.type === "ExpressionStatement" ||
      current.type === "VariableDeclarator" ||
      current.type === "CallExpression" ||
      current.type === "ReturnStatement"
    ) {
      return false;
    }

    return checkParent(current.parent);
  };

  return checkParent(node.parent);
};

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using the React namespace for accessing React APIs. Use destructured imports instead (e.g., import { useState } from 'react').",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} node
       */
      MemberExpression(node) {
        if (node.type !== "MemberExpression") return;

        if (!isReactNamespaceAccess(node)) return;

        // Allow React namespace in type annotations
        if (isTypeContext(node)) return;

        const propertyName = node.property && node.property.type === "Identifier" ? node.property.name : "property";

        context.report({
          node,
          message: `Avoid using 'React.${propertyName}'. Import '${propertyName}' directly from 'react' instead (e.g., import { ${propertyName} } from 'react').`,
        });
      },
    });
  },
});

export const noReactNamespaceRule = rule;
