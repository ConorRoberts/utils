import { defineRule } from "oxlint/plugins";

/** @typedef {import("oxlint/plugins").ESTree.Node} ESTNode */

const DEFAULT_MAX_DEPTH = 2;

/**
 * @param {unknown} node
 * @returns {node is ESTNode & { type: string }}
 */
const isNode = (node) => Boolean(node && typeof node === "object" && "type" in node);

/**
 * @param {ESTNode} node
 * @returns {boolean}
 */
const isFunctionLike = (node) =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ArrowFunctionExpression";

/**
 * Treat standalone blocks as separate scopes. Blocks used as conditional/loop bodies
 * do not reset nesting depth.
 * @param {ESTNode} node
 * @returns {boolean}
 */
const isStandaloneBlock = (node) => {
  if (node.type !== "BlockStatement") return false;

  const parent = node.parent;
  if (!isNode(parent)) return false;

  return parent.type === "Program" || parent.type === "BlockStatement";
};

/**
 * @param {ESTNode} node
 * @returns {boolean}
 */
const isElseIf = (node) => {
  if (node.type !== "IfStatement") return false;
  const parent = node.parent;
  if (!isNode(parent) || parent.type !== "IfStatement") return false;
  return parent.alternate === node;
};

export const noNestedConditionalsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow nesting conditionals more than a configured depth within a single scope",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "integer",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    const maxDepth =
      typeof context.options?.[0]?.maxDepth === "number"
        ? context.options[0].maxDepth
        : DEFAULT_MAX_DEPTH;

    const scopeStack = [];

    const enterScope = () => {
      scopeStack.push({ depth: 0, increments: [] });
    };

    const exitScope = () => {
      scopeStack.pop();
    };

    const currentScope = () => scopeStack[scopeStack.length - 1];

    /** @param {ESTNode} node */
    const enterConditional = (node) => {
      const scope = currentScope();
      if (!scope) return;

      const increment = isElseIf(node) ? 0 : 1;
      const nextDepth = scope.depth + increment;

      if (nextDepth > maxDepth) {
        context.report({
          node,
          message: `Avoid nesting conditionals more than ${maxDepth} levels within the same scope. Prefer early returns or extract branches into separate functions.`,
        });
      }

      scope.depth = nextDepth;
      scope.increments.push(increment);
    };

    const exitConditional = () => {
      const scope = currentScope();
      if (!scope) return;

      const increment = scope.increments.pop();
      if (increment === undefined) return;

      scope.depth -= increment;
    };

    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      Program() {
        enterScope();
      },
      "Program:exit"() {
        exitScope();
      },
      FunctionDeclaration(node) {
        if (isFunctionLike(node)) enterScope();
      },
      "FunctionDeclaration:exit"() {
        exitScope();
      },
      FunctionExpression(node) {
        if (isFunctionLike(node)) enterScope();
      },
      "FunctionExpression:exit"() {
        exitScope();
      },
      ArrowFunctionExpression(node) {
        if (isFunctionLike(node)) enterScope();
      },
      "ArrowFunctionExpression:exit"() {
        exitScope();
      },
      BlockStatement(node) {
        if (isStandaloneBlock(node)) enterScope();
      },
      "BlockStatement:exit"(node) {
        if (isStandaloneBlock(node)) exitScope();
      },
      IfStatement(node) {
        if (node.type === "IfStatement") enterConditional(node);
      },
      "IfStatement:exit"() {
        exitConditional();
      },
      ConditionalExpression(node) {
        if (node.type === "ConditionalExpression") enterConditional(node);
      },
      "ConditionalExpression:exit"() {
        exitConditional();
      },
      SwitchStatement(node) {
        if (node.type === "SwitchStatement") enterConditional(node);
      },
      "SwitchStatement:exit"() {
        exitConditional();
      },
    });
  },
});
