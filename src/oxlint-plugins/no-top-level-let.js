import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `let` keyword everywhere except at module scope and in for loop initializers.",
      recommended: false,
    },
    schema: [],
    messages: {
      noLet: "Avoid `let`. Use `const`, or limit `let` to module scope or `for` loop initializers.",
      topLevelMutation:
        "Do not mutate properties of top-level const `{{name}}`. Move the mutable state into a function or update immutably (create a new object/array).",
    },
  },

  createOnce(context) {
    /** @type {Set<string>} */
    const topLevelMutableBindings = new Set();

    /**
     * @param {unknown} node
     * @returns {node is ESTNode & { type: string }}
     */
    const isNode = (node) => Boolean(node && typeof node === "object" && "type" in node);

    /**
     * @param {ESTNode} node
     * @returns {boolean}
     */
    const isTopLevelVariableDeclaration = (node) => {
      const parent = node.parent;
      if (!parent || !isNode(parent)) return false;
      if (parent.type === "Program") return true;
      if (parent.type === "ExportNamedDeclaration" && parent.parent?.type === "Program") {
        return true;
      }
      return false;
    };

    /**
     * @param {ESTNode | null | undefined} node
     * @returns {boolean}
     */
    const isMutableObjectInit = (node) => {
      if (!node || !isNode(node)) return false;
      if (node.type === "ObjectExpression" || node.type === "ArrayExpression") {
        return true;
      }
      if (node.type === "NewExpression" && node.callee?.type === "Identifier") {
        return ["Map", "Set", "WeakMap", "WeakSet"].includes(node.callee.name);
      }
      return false;
    };

    /**
     * @param {ESTNode} node
     * @returns {ESTNode | null}
     */
    const unwrapExpression = (node) => {
      let current = node;
      while (current && isNode(current)) {
        if (current.type === "TSAsExpression" || current.type === "TSNonNullExpression") {
          current = current.expression;
          continue;
        }
        return current;
      }
      return null;
    };

    /**
     * @param {ESTNode} node
     * @returns {string | null}
     */
    const getMemberRootName = (node) => {
      let current = unwrapExpression(node);
      while (current && isNode(current)) {
        if (current.type === "MemberExpression") {
          current = unwrapExpression(current.object);
          continue;
        }
        if (current.type === "Identifier") {
          return current.name;
        }
        return null;
      }
      return null;
    };

    /**
     * @param {ESTNode} node
     * @returns {string | null}
     */
    const getMemberPropertyName = (node) => {
      if (!isNode(node) || node.type !== "MemberExpression") return null;
      if (node.property?.type === "Identifier" && node.computed === false) {
        return node.property.name;
      }
      if (node.property?.type === "Literal" && typeof node.property.value === "string") {
        return node.property.value;
      }
      return null;
    };

    const mutatingMethods = new Set([
      "push",
      "pop",
      "splice",
      "shift",
      "unshift",
      "sort",
      "reverse",
      "copyWithin",
      "fill",
      "set",
      "add",
      "delete",
      "clear",
    ]);

    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * @param {ESTNode} rawNode
       */
      VariableDeclaration(rawNode) {
        if (rawNode.type !== "VariableDeclaration") return;
        const node = rawNode;

        if (node.kind !== "let") return;

        // Allow let at module scope
        if (isTopLevelVariableDeclaration(node)) return;

        // Allow let in for loop initializers
        const parent = node.parent;
        if (parent) {
          // For traditional for loops, check init property
          if (parent.type === "ForStatement" && parent.init === node) {
            return;
          }
          // For for-in and for-of loops, check left property
          if ((parent.type === "ForInStatement" || parent.type === "ForOfStatement") && parent.left === node) {
            return;
          }
        }

        context.report({
          node,
          messageId: "noLet",
        });
      },

      /**
       * Track top-level const bindings initialized with mutable objects.
       * @param {ESTNode} rawNode
       */
      VariableDeclarator(rawNode) {
        if (rawNode.type !== "VariableDeclarator") return;
        const declarator = rawNode;
        const declaration = declarator.parent;
        if (!declaration || !isNode(declaration) || declaration.type !== "VariableDeclaration") {
          return;
        }
        if (declaration.kind !== "const") return;
        if (!isTopLevelVariableDeclaration(declaration)) return;
        if (!isMutableObjectInit(declarator.init)) return;
        if (declarator.id?.type !== "Identifier") return;

        topLevelMutableBindings.add(declarator.id.name);
      },

      /**
       * @param {ESTNode} rawNode
       */
      AssignmentExpression(rawNode) {
        if (rawNode.type !== "AssignmentExpression") return;
        const left = rawNode.left;
        if (!left || !isNode(left) || left.type !== "MemberExpression") return;

        const rootName = getMemberRootName(left);
        if (!rootName || !topLevelMutableBindings.has(rootName)) return;

        context.report({
          node: rawNode,
          messageId: "topLevelMutation",
          data: { name: rootName },
        });
      },

      /**
       * @param {ESTNode} rawNode
       */
      UpdateExpression(rawNode) {
        if (rawNode.type !== "UpdateExpression") return;
        const argument = rawNode.argument;
        if (!argument || !isNode(argument) || argument.type !== "MemberExpression") return;

        const rootName = getMemberRootName(argument);
        if (!rootName || !topLevelMutableBindings.has(rootName)) return;

        context.report({
          node: rawNode,
          messageId: "topLevelMutation",
          data: { name: rootName },
        });
      },

      /**
       * @param {ESTNode} rawNode
       */
      CallExpression(rawNode) {
        if (rawNode.type !== "CallExpression") return;
        const callee = rawNode.callee;
        if (!callee || !isNode(callee) || callee.type !== "MemberExpression") return;

        const rootName = getMemberRootName(callee);
        if (!rootName || !topLevelMutableBindings.has(rootName)) return;

        const methodName = getMemberPropertyName(callee);
        if (!methodName || !mutatingMethods.has(methodName)) return;

        context.report({
          node: rawNode,
          messageId: "topLevelMutation",
          data: { name: rootName },
        });
      },
    });
  },
});

export const noTopLevelLetRule = rule;
