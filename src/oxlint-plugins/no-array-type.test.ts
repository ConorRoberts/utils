import type { ESTree } from "oxlint";
import { assert, describe, expect, it } from "vitest";
import { noArrayTypeRule } from "./no-array-type.js";
import { createRuleHarness, createSpan } from "./test-utils.js";

const createTSTypeReference = (typeName: string, hasTypeParameters = false): ESTree.TSTypeReference => {
  const identifier = {
    type: "Identifier" as const,
    name: typeName,
    ...createSpan(),
  };

  const typeRef = {
    type: "TSTypeReference" as const,
    typeName: identifier,
    typeParameters: hasTypeParameters ? {} : undefined,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  return typeRef as unknown as ESTree.TSTypeReference;
};

describe("no-array-type rule", () => {
  it("reports Array<T> syntax", () => {
    const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
    const typeRef = createTSTypeReference("Array", true);

    assert.isDefined(visitor.TSTypeReference);
    visitor.TSTypeReference(typeRef);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: typeRef,
        message: expect.stringContaining("Use T[] syntax instead of Array<T>"),
      }),
    );
  });

  it("allows T[] syntax", () => {
    const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
    // T[] syntax would be represented differently in the AST, not as TSTypeReference to "Array"
    const typeRef = createTSTypeReference("string", false);

    assert.isDefined(visitor.TSTypeReference);
    visitor.TSTypeReference(typeRef);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows other generic types", () => {
    const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
    const typeRef = createTSTypeReference("Promise", true);

    assert.isDefined(visitor.TSTypeReference);
    visitor.TSTypeReference(typeRef);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows Array without type parameters", () => {
    const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
    const typeRef = createTSTypeReference("Array", false);

    assert.isDefined(visitor.TSTypeReference);
    visitor.TSTypeReference(typeRef);

    expect(report).not.toHaveBeenCalled();
  });
});
