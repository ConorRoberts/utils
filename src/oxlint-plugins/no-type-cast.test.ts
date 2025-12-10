import { assert, describe, expect, it } from "vitest";
import type { ESTree } from "oxlint";
import { noTypeCastRule } from "./no-type-cast.js";
import { createRuleHarness, createSpan, createIdentifier } from "./test-utils.js";

const createTSAsExpression = (isConst = false): ESTree.TSAsExpression => {
  const expression = createIdentifier("value");

  const typeAnnotation: ESTree.TSType = isConst
    ? ({
        type: "TSTypeReference",
        typeName: createIdentifier("const"),
        ...createSpan(),
      } as unknown as ESTree.TSType)
    : ({
        type: "TSStringKeyword",
        ...createSpan(),
      } as unknown as ESTree.TSType);

  const asExpression = {
    type: "TSAsExpression" as const,
    expression,
    typeAnnotation,
    ...createSpan(),
  };

  const node = asExpression as unknown as ESTree.TSAsExpression;
  expression.parent = node;
  typeAnnotation.parent = node;

  return node;
};

const createTSTypeAssertion = (): ESTree.TSTypeAssertion => {
  const expression = createIdentifier("value");
  const typeAnnotation: ESTree.TSType = {
    type: "TSStringKeyword",
    ...createSpan(),
  } as unknown as ESTree.TSType;

  const typeAssertion = {
    type: "TSTypeAssertion" as const,
    expression,
    typeAnnotation,
    ...createSpan(),
  };

  const node = typeAssertion as unknown as ESTree.TSTypeAssertion;
  expression.parent = node;
  typeAnnotation.parent = node;

  return node;
};

const createTSNonNullExpression = (): ESTree.TSNonNullExpression => {
  const expression = createIdentifier("value");

  const nonNullExpression = {
    type: "TSNonNullExpression" as const,
    expression,
    ...createSpan(),
  };

  const node = nonNullExpression as unknown as ESTree.TSNonNullExpression;
  expression.parent = node;

  return node;
};

describe("no-type-cast", () => {
  it("reports error for 'as' type assertion", () => {
    const { report, visitor } = createRuleHarness(noTypeCastRule, "no-type-cast/test");
    const asExpression = createTSAsExpression();

    assert.isDefined(visitor.TSAsExpression);
    visitor.TSAsExpression(asExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: asExpression,
        message: expect.stringContaining("Type casting with `as` is not permitted"),
      }),
    );
  });

  it("reports error for angle-bracket type assertion", () => {
    const { report, visitor } = createRuleHarness(noTypeCastRule, "no-type-cast/test");
    const typeAssertion = createTSTypeAssertion();

    assert.isDefined(visitor.TSTypeAssertion);
    visitor.TSTypeAssertion(typeAssertion);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: typeAssertion,
        message: expect.stringContaining("Type casting with angle brackets"),
      }),
    );
  });

  it("reports error for non-null assertion operator", () => {
    const { report, visitor } = createRuleHarness(noTypeCastRule, "no-type-cast/test");
    const nonNullExpression = createTSNonNullExpression();

    assert.isDefined(visitor.TSNonNullExpression);
    visitor.TSNonNullExpression(nonNullExpression);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: nonNullExpression,
        message: expect.stringContaining("Non-null assertion operator `!` is not permitted"),
      }),
    );
  });

  it("allows 'as const' assertions", () => {
    const { report, visitor } = createRuleHarness(noTypeCastRule, "no-type-cast/test");
    const asConstExpression = createTSAsExpression(true);

    assert.isDefined(visitor.TSAsExpression);
    visitor.TSAsExpression(asConstExpression);

    expect(report).not.toHaveBeenCalled();
  });
});
