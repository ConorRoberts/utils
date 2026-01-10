import { describe, expect, it } from "vitest";
import type { ESTree } from "oxlint";
import { noIifeRule } from "./no-iife.js";
import { createRuleHarness, createSpan, createFunctionBody } from "./test-utils.js";

describe("no-iife", () => {
  it("should report when function expression is immediately invoked", () => {
    const { report, visitor } = createRuleHarness(noIifeRule, "no-iife");

    const functionExpr = {
      type: "FunctionExpression" as const,
      id: null,
      params: [],
      body: createFunctionBody(),
      async: false,
      generator: false,
      expression: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const functionNode = functionExpr as unknown as ESTree.Function;

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: functionNode,
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    functionNode.parent = node;

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message:
        "Immediately Invoked Function Expressions (IIFE) are disallowed. Use a regular function declaration or block scope instead.",
    });
  });

  it("should report when arrow function is immediately invoked", () => {
    const { report, visitor } = createRuleHarness(noIifeRule, "no-iife");

    const arrowExpr = {
      type: "ArrowFunctionExpression" as const,
      params: [],
      body: createFunctionBody(),
      async: false,
      expression: false,
      id: null,
      generator: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const arrowNode = arrowExpr as unknown as ESTree.ArrowFunctionExpression;

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: arrowNode,
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    arrowNode.parent = node;

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message:
        "Immediately Invoked Function Expressions (IIFE) are disallowed. Use a regular function declaration or block scope instead.",
    });
  });

  it("should report when async function expression is immediately invoked", () => {
    const { report, visitor } = createRuleHarness(noIifeRule, "no-iife");

    const functionExpr = {
      type: "FunctionExpression" as const,
      id: null,
      params: [],
      body: createFunctionBody(),
      async: true,
      generator: false,
      expression: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const functionNode = functionExpr as unknown as ESTree.Function;

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee: functionNode,
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    functionNode.parent = node;

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message:
        "Immediately Invoked Function Expressions (IIFE) are disallowed. Use a regular function declaration or block scope instead.",
    });
  });

  it("should not report for regular function calls", () => {
    const { report, visitor } = createRuleHarness(noIifeRule, "no-iife");

    const callee: ESTree.IdentifierReference = {
      type: "Identifier",
      name: "myFunction",
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee,
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    callee.parent = node;

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });

  it("should not report for method calls", () => {
    const { report, visitor } = createRuleHarness(noIifeRule, "no-iife");

    const object: ESTree.IdentifierReference = {
      type: "Identifier",
      name: "myObject",
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const property: ESTree.IdentifierName = {
      type: "Identifier",
      name: "myMethod",
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const callee: ESTree.MemberExpression = {
      type: "MemberExpression",
      object,
      property,
      computed: false,
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee,
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    object.parent = callee;
    property.parent = callee;
    callee.parent = node;

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });

  it("should not report when function is assigned and then called", () => {
    const { report, visitor } = createRuleHarness(noIifeRule, "no-iife");

    const callee: ESTree.IdentifierReference = {
      type: "Identifier",
      name: "fn",
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const node: ESTree.CallExpression = {
      type: "CallExpression",
      callee,
      arguments: [],
      optional: false,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    callee.parent = node;

    if ("CallExpression" in visitor && visitor.CallExpression) {
      visitor.CallExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });
});
