import type { ESTree } from "oxlint/plugins";
import { assert, describe, expect, it } from "vitest";
import { noArrayTypeRule } from "./no-array-type.js";
import { createRuleHarness, createSpan } from "./test-utils.js";

const createTSTypeReference = (
  typeName: string,
  hasTypeParameters = false,
  typeNameNode?: ESTree.Node,
): ESTree.TSTypeReference => {
  const identifier = typeNameNode ?? {
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
  describe("basic Array<T> detection", () => {
    it("reports Array<string> syntax", () => {
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

    it("reports Array<number> syntax", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("Array", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).toHaveBeenCalledTimes(1);
    });

    it("allows T[] syntax", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // T[] syntax would be represented differently in the AST, not as TSTypeReference to "Array"
      const typeRef = createTSTypeReference("string", false);

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

  describe("complex type parameters", () => {
    it("reports Array with object type parameter", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // This represents Array<{ productRequestId: string; version: number }> syntax
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

    it("reports Array with union type parameter", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // This represents Array<string | number> syntax
      const typeRef = createTSTypeReference("Array", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).toHaveBeenCalledTimes(1);
    });

    it("reports Array with interface type parameter", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // This represents Array<MyInterface> syntax
      const typeRef = createTSTypeReference("Array", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).toHaveBeenCalledTimes(1);
    });

    it("reports nested Array types", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // This represents Array<Array<string>> syntax - outer Array
      const typeRef = createTSTypeReference("Array", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).toHaveBeenCalledTimes(1);
    });
  });

  describe("non-array generic types", () => {
    it("allows Promise<T>", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("Promise", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).not.toHaveBeenCalled();
    });

    it("allows Record<K, V>", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("Record", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).not.toHaveBeenCalled();
    });

    it("allows Map<K, V>", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("Map", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).not.toHaveBeenCalled();
    });

    it("allows Set<T>", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("Set", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).not.toHaveBeenCalled();
    });

    it("allows Partial<T>", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("Partial", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("interface property types", () => {
    it("reports Array type in interface property", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // This represents the exact case from RevisionHistoryCardProps
      // interface Foo { versions: Array<{ id: string }> }
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

    it("reports multiple Array types in same interface", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");

      // First property with Array type
      const typeRef1 = createTSTypeReference("Array", true);
      // Second property with Array type
      const typeRef2 = createTSTypeReference("Array", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef1);
      visitor.TSTypeReference(typeRef2);

      expect(report).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("allows ReadonlyArray with type parameters", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const typeRef = createTSTypeReference("ReadonlyArray", true);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      expect(report).not.toHaveBeenCalled();
    });

    it("handles qualified type names (not just Identifier)", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      // Qualified name like React.FC should not crash the rule
      const qualifiedName = {
        type: "TSQualifiedName" as const,
        left: {
          type: "Identifier" as const,
          name: "React",
          ...createSpan(),
        },
        right: {
          type: "Identifier" as const,
          name: "FC",
          ...createSpan(),
        },
        ...createSpan(),
      };

      const typeRef = createTSTypeReference("React.FC", true, qualifiedName as unknown as ESTree.Node);

      assert.isDefined(visitor.TSTypeReference);
      visitor.TSTypeReference(typeRef);

      // Should not report, and should not crash
      expect(report).not.toHaveBeenCalled();
    });

    it("handles nodes with wrong type gracefully", () => {
      const { report, visitor } = createRuleHarness(noArrayTypeRule, "no-array-type/test");
      const wrongNode = {
        type: "Identifier" as const,
        name: "Array",
        ...createSpan(),
      };

      assert.isDefined(visitor.TSTypeReference);
      // Calling with wrong node type should not crash
      visitor.TSTypeReference(wrongNode as unknown as ESTree.TSTypeReference);

      expect(report).not.toHaveBeenCalled();
    });
  });
});
