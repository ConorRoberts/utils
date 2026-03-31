import { describe, expect, it } from "vitest";
import type { ESTree } from "@oxlint/plugins";
import { noVoidRule } from "./no-void.js";
import { createRuleHarness, createSpan } from "./test-utils.js";

describe("no-void", () => {
  it("should report when void operator is used", () => {
    const { report, visitor } = createRuleHarness(noVoidRule, "no-void");

    const node: ESTree.UnaryExpression = {
      type: "UnaryExpression",
      operator: "void",
      argument: {
        type: "Identifier",
        name: "foo",
      } as ESTree.IdentifierReference,
      prefix: true,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("UnaryExpression" in visitor && visitor.UnaryExpression) {
      visitor.UnaryExpression(node);
    }

    expect(report).toHaveBeenCalledWith({
      node,
      message: "Use of 'void' operator is disallowed in JavaScript.",
    });
  });

  it("should not report for other unary operators", () => {
    const { report, visitor } = createRuleHarness(noVoidRule, "no-void");

    const node: ESTree.UnaryExpression = {
      type: "UnaryExpression",
      operator: "typeof",
      argument: {
        type: "Identifier",
        name: "foo",
      } as ESTree.IdentifierReference,
      prefix: true,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("UnaryExpression" in visitor && visitor.UnaryExpression) {
      visitor.UnaryExpression(node);
    }

    expect(report).not.toHaveBeenCalled();
  });

  it("should not report for the TypeScript void type", () => {
    const { report, visitor } = createRuleHarness(noVoidRule, "no-void");

    const node: ESTree.TSVoidKeyword = {
      type: "TSVoidKeyword",
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    if ("TSVoidKeyword" in visitor && visitor.TSVoidKeyword) {
      visitor.TSVoidKeyword(node);
    }

    expect(report).not.toHaveBeenCalled();
  });
});
