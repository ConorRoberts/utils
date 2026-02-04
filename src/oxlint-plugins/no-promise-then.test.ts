import { describe, expect, it } from "vitest";
import type { ESTree } from "oxlint/plugins";
import { noPromiseThenRule } from "./no-promise-then.js";
import { createRuleHarness, createSpan, createIdentifier } from "./test-utils.js";

describe("no-promise-then", () => {
  it("should report when .then() is called on a promise", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: createIdentifier("promise"),
        property: createIdentifier("then"),
        computed: false,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message: 'Avoid using .then() on promises. Use async/await instead.',
    });
  });

  it("should report when .then() is called on a fetch result", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: {
          type: "CallExpression",
          callee: createIdentifier("fetch"),
          arguments: [],
          optional: false,
          parent: undefined as unknown as ESTree.Node,
          ...createSpan(),
        },
        property: createIdentifier("then"),
        computed: false,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message: 'Avoid using .then() on promises. Use async/await instead.',
    });
  });

  it("should report when .then() is called on Promise.resolve()", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: {
          type: "CallExpression",
          callee: {
            type: "MemberExpression",
            object: createIdentifier("Promise"),
            property: createIdentifier("resolve"),
            computed: false,
            optional: false,
            parent: undefined as unknown as ESTree.Node,
            ...createSpan(),
          },
          arguments: [],
          optional: false,
          parent: undefined as unknown as ESTree.Node,
          ...createSpan(),
        },
        property: createIdentifier("then"),
        computed: false,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message: 'Avoid using .then() on promises. Use async/await instead.',
    });
  });

  it("should not report for regular function calls", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: createIdentifier("someFunction"),
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });

  it("should not report for method calls with names other than 'then'", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: createIdentifier("promise"),
        property: createIdentifier("catch"),
        computed: false,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });

  it("should not report for computed member expressions like promise['then']()", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: createIdentifier("promise"),
        property: {
          type: "Literal",
          value: "then",
          raw: '"then"',
          parent: undefined as unknown as ESTree.Node,
          ...createSpan(),
        },
        computed: true,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });

  it("should report for chained .then() calls", () => {
    const { report, visitor } = createRuleHarness(noPromiseThenRule, "no-promise-then");

    // First .then() call in the chain
    const firstThenNode: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: createIdentifier("promise"),
        property: createIdentifier("then"),
        computed: false,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    // Second .then() call in the chain
    const secondThenNode: ESTree.CallExpression = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: firstThenNode,
        property: createIdentifier("then"),
        computed: false,
        optional: false,
        parent: undefined as unknown as ESTree.Node,
        ...createSpan(),
      },
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(firstThenNode);
      visitor.CallExpression(secondThenNode);
    }

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith({
      node: firstThenNode,
      message: 'Avoid using .then() on promises. Use async/await instead.',
    });
    expect(report).toHaveBeenCalledWith({
      node: secondThenNode,
      message: 'Avoid using .then() on promises. Use async/await instead.',
    });
  });
});
