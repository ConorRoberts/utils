import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noFunctionCallInJsxRule } from "./no-function-call-in-jsx.js";
import {
  createIdentifierReference,
  createJSXElement,
  createJSXExpressionContainer,
  createRuleHarness,
  createSpan,
} from "./test-utils";

const createCallExpression = (calleeName: string, args: ESTree.Expression[] = []): ESTree.CallExpression => {
  const callee = createIdentifierReference(calleeName);
  const call = {
    type: "CallExpression" as const,
    callee,
    arguments: args,
    optional: false,
    ...createSpan(),
  };

  const callExpression = call as unknown as ESTree.CallExpression;
  callee.parent = callExpression;
  for (const arg of args) {
    arg.parent = callExpression;
  }

  return callExpression;
};

const createMemberCallExpression = (
  objectName: string,
  propertyName: string,
  args: ESTree.Expression[] = [],
): ESTree.CallExpression => {
  const object = createIdentifierReference(objectName);
  const property = createIdentifierReference(propertyName);

  const memberExpression = {
    type: "MemberExpression" as const,
    object,
    property,
    computed: false,
    optional: false,
    ...createSpan(),
  };

  const member = memberExpression as unknown as ESTree.MemberExpression;
  object.parent = member;
  property.parent = member;

  const call = {
    type: "CallExpression" as const,
    callee: member,
    arguments: args,
    optional: false,
    ...createSpan(),
  };

  const callExpression = call as unknown as ESTree.CallExpression;
  member.parent = callExpression;
  for (const arg of args) {
    arg.parent = callExpression;
  }

  return callExpression;
};

describe("no-function-call-in-jsx rule", () => {
  it("reports a function call inside JSX expression container", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const callExpression = createCallExpression("getData");
    const container = createJSXExpressionContainer(callExpression);
    const element = createJSXElement("div");

    element.children.push(container);
    container.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: callExpression,
        message: expect.stringContaining("getData"),
      }),
    );
  });

  it("reports a member expression function call inside JSX", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const callExpression = createMemberCallExpression("user", "getName");
    const container = createJSXExpressionContainer(callExpression);
    const element = createJSXElement("div");

    element.children.push(container);
    container.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: callExpression,
        message: expect.stringContaining("getName"),
      }),
    );
  });

  it("reports multiple function calls inside JSX", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const firstCall = createCallExpression("getTitle");
    const firstContainer = createJSXExpressionContainer(firstCall);

    const secondCall = createCallExpression("getDescription");
    const secondContainer = createJSXExpressionContainer(secondCall);

    const element = createJSXElement("div");
    element.children.push(firstContainer, secondContainer);
    firstContainer.parent = element;
    secondContainer.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);

    callVisitor(firstCall);
    callVisitor(secondCall);

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        node: firstCall,
        message: expect.stringContaining("getTitle"),
      }),
    );
    expect(report).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        node: secondCall,
        message: expect.stringContaining("getDescription"),
      }),
    );
  });

  it("does not report function calls outside of JSX", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const callExpression = createCallExpression("normalFunction");

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports nested function calls inside JSX", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const innerCall = createCallExpression("innerFn");
    const outerCall = createCallExpression("outerFn", [innerCall as unknown as ESTree.Expression]);
    const container = createJSXExpressionContainer(outerCall);
    const element = createJSXElement("div");

    element.children.push(container);
    container.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);

    // Both the inner and outer calls should be reported
    callVisitor(innerCall);
    callVisitor(outerCall);

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: innerCall,
        message: expect.stringContaining("innerFn"),
      }),
    );
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: outerCall,
        message: expect.stringContaining("outerFn"),
      }),
    );
  });

  it("reports function calls with arguments inside JSX", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const arg = createIdentifierReference("value");
    const callExpression = createCallExpression("formatValue", [arg as unknown as ESTree.Expression]);
    const container = createJSXExpressionContainer(callExpression);
    const element = createJSXElement("span");

    element.children.push(container);
    container.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: callExpression,
        message: expect.stringContaining("formatValue"),
      }),
    );
  });

  it("reports chained method calls inside JSX", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const callExpression = createMemberCallExpression("array", "map");
    const container = createJSXExpressionContainer(callExpression);
    const element = createJSXElement("ul");

    element.children.push(container);
    container.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: callExpression,
        message: expect.stringContaining("map"),
      }),
    );
  });

  it("provides helpful error message for anonymous functions", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    // Create an arrow function as callee
    const arrowFn = {
      type: "ArrowFunctionExpression" as const,
      expression: true,
      async: false,
      params: [],
      body: createIdentifierReference("result"),
      id: null,
      generator: false,
      ...createSpan(),
    };

    const arrow = arrowFn as unknown as ESTree.ArrowFunctionExpression;
    arrow.body.parent = arrow;

    const call = {
      type: "CallExpression" as const,
      callee: arrow,
      arguments: [],
      optional: false,
      ...createSpan(),
    };

    const callExpression = call as unknown as ESTree.CallExpression;
    arrow.parent = callExpression;

    const container = createJSXExpressionContainer(callExpression);
    const element = createJSXElement("div");

    element.children.push(container);
    container.parent = element;

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: callExpression,
        message: expect.stringContaining("function"),
      }),
    );
  });

  it("does not report function calls in JSX attributes that are not in expression containers", () => {
    const { report, visitor } = createRuleHarness(noFunctionCallInJsxRule, "no-function-call-in-jsx/test");

    const callExpression = createCallExpression("handleClick");

    // Simulate a call expression that's not in a JSX expression container
    // (this would be outside JSX entirely in real code)
    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    expect(report).not.toHaveBeenCalled();
  });
});
