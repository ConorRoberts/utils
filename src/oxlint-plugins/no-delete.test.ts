import { describe, expect, it } from "vitest";
import type { ESTree } from "oxlint";
import { noDeleteRule } from "./no-delete.js";
import { createRuleHarness, createSpan } from "./test-utils.js";

describe("no-delete", () => {
  it("should report when delete operator is used", () => {
    const { report, visitor } = createRuleHarness(noDeleteRule, "no-delete");

    const node: ESTree.UnaryExpression = {
      type: "UnaryExpression",
      operator: "delete",
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
      message:
        "Use of 'delete' operator is disallowed. Use object destructuring or set properties to undefined instead.",
    });
  });

  it("should not report for other unary operators", () => {
    const { report, visitor } = createRuleHarness(noDeleteRule, "no-delete");

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

  it("should not report for negation operator", () => {
    const { report, visitor } = createRuleHarness(noDeleteRule, "no-delete");

    const node: ESTree.UnaryExpression = {
      type: "UnaryExpression",
      operator: "!",
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
});
