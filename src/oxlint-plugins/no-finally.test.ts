import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noFinallyRule } from "./no-finally.js";
import { createRuleHarness, createSpan } from "./test-utils.js";

const createTryStatement = (hasFinalizer: boolean): ESTree.TryStatement => {
  const tryStatement = {
    type: "TryStatement" as const,
    block: null as unknown as ESTree.BlockStatement,
    handler: null as ESTree.CatchClause | null,
    finalizer: null as ESTree.BlockStatement | null,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const block: ESTree.BlockStatement = {
    type: "BlockStatement",
    body: [],
    parent: tryStatement as unknown as ESTree.Node,
    ...createSpan(),
  };

  const catchBody: ESTree.BlockStatement = {
    type: "BlockStatement",
    body: [],
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const catchClause: ESTree.CatchClause = {
    type: "CatchClause",
    param: null,
    body: catchBody,
    parent: tryStatement as unknown as ESTree.Node,
    ...createSpan(),
  };

  catchBody.parent = catchClause as unknown as ESTree.Node;

  const finalizer: ESTree.BlockStatement | null = hasFinalizer
    ? {
        type: "BlockStatement",
        body: [],
        parent: tryStatement as unknown as ESTree.Node,
        ...createSpan(),
      }
    : null;

  tryStatement.block = block;
  tryStatement.handler = catchClause;
  tryStatement.finalizer = finalizer;

  return tryStatement as unknown as ESTree.TryStatement;
};

describe("no-finally rule", () => {
  it("reports try/catch/finally with finalizer block", () => {
    const { report, visitor } = createRuleHarness(noFinallyRule, "no-finally/test");
    const tryStatement = createTryStatement(true);

    assert.isDefined(visitor.TryStatement);

    visitor.TryStatement(tryStatement);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: tryStatement.finalizer,
        message: expect.stringContaining("finally"),
      }),
    );
  });

  it("ignores try/catch without finalizer block", () => {
    const { report, visitor } = createRuleHarness(noFinallyRule, "no-finally/test");
    const tryStatement = createTryStatement(false);

    assert.isDefined(visitor.TryStatement);

    visitor.TryStatement(tryStatement);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports try with only finally block", () => {
    const { report, visitor } = createRuleHarness(noFinallyRule, "no-finally/test");

    const tryStatement = {
      type: "TryStatement" as const,
      block: null as unknown as ESTree.BlockStatement,
      handler: null,
      finalizer: null as unknown as ESTree.BlockStatement,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    };

    const block: ESTree.BlockStatement = {
      type: "BlockStatement",
      body: [],
      parent: tryStatement as unknown as ESTree.Node,
      ...createSpan(),
    };

    const finalizer: ESTree.BlockStatement = {
      type: "BlockStatement",
      body: [],
      parent: tryStatement as unknown as ESTree.Node,
      ...createSpan(),
    };

    tryStatement.block = block;
    tryStatement.finalizer = finalizer;

    const statement = tryStatement as unknown as ESTree.TryStatement;

    assert.isDefined(visitor.TryStatement);

    visitor.TryStatement(statement);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: statement.finalizer,
      }),
    );
  });
});
