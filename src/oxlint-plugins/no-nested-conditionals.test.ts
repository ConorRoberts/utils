import { describe, expect, it } from "vitest";
import type { ESTree } from "oxlint/plugins";
import { noNestedConditionalsRule } from "./no-nested-conditionals.js";
import { createIdentifierReference, createProgram, createRuleHarness, createSpan } from "./test-utils.js";

const createBlockStatement = (parent?: ESTree.Node): ESTree.BlockStatement => {
  const block = {
    type: "BlockStatement" as const,
    body: [],
    parent,
    ...createSpan(),
  } as unknown as ESTree.BlockStatement;

  return block;
};

const appendStatement = (block: ESTree.BlockStatement, statement: ESTree.Statement) => {
  block.body.push(statement);
  statement.parent = block;
};

const createIfStatement = (
  testName: string,
  consequent: ESTree.Statement,
  alternate: ESTree.Statement | null = null,
): ESTree.IfStatement => {
  const test = createIdentifierReference(testName);

  const ifStmt = {
    type: "IfStatement" as const,
    test,
    consequent,
    alternate,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  } as unknown as ESTree.IfStatement;

  test.parent = ifStmt;
  consequent.parent = ifStmt;
  if (alternate) alternate.parent = ifStmt;

  return ifStmt;
};

const createConditionalExpression = (testName: string): ESTree.ConditionalExpression => {
  const test = createIdentifierReference(testName);
  const consequent = createIdentifierReference("x");
  const alternate = createIdentifierReference("y");

  const expr = {
    type: "ConditionalExpression" as const,
    test,
    consequent,
    alternate,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  } as unknown as ESTree.ConditionalExpression;

  test.parent = expr;
  consequent.parent = expr;
  alternate.parent = expr;

  return expr;
};

describe("no-nested-conditionals", () => {
  it("should report when nesting exceeds two levels", () => {
    const { report, visitor } = createRuleHarness(noNestedConditionalsRule, "no-nested-conditionals");

    const program = createProgram();

    const block3 = createBlockStatement();
    const if3 = createIfStatement("c", block3);
    appendStatement(block3, {
      type: "EmptyStatement",
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    } as ESTree.EmptyStatement);

    const block2 = createBlockStatement();
    const if2 = createIfStatement("b", block2);
    appendStatement(block2, if3);

    const block1 = createBlockStatement();
    const if1 = createIfStatement("a", block1);
    appendStatement(block1, if2);

    if1.parent = program;
    program.body.push(if1);

    visitor.Program?.(program);
    visitor.IfStatement?.(if1);
    visitor.IfStatement?.(if2);
    visitor.IfStatement?.(if3);
    visitor["IfStatement:exit"]?.(if3);
    visitor["IfStatement:exit"]?.(if2);
    visitor["IfStatement:exit"]?.(if1);
    visitor["Program:exit"]?.(program);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ node: if3 }));
  });

  it("should allow nesting up to two levels", () => {
    const { report, visitor } = createRuleHarness(noNestedConditionalsRule, "no-nested-conditionals");

    const program = createProgram();

    const block2 = createBlockStatement();
    const if2 = createIfStatement("b", block2);

    const block1 = createBlockStatement();
    const if1 = createIfStatement("a", block1);
    appendStatement(block1, if2);

    if1.parent = program;
    program.body.push(if1);

    visitor.Program?.(program);
    visitor.IfStatement?.(if1);
    visitor.IfStatement?.(if2);
    visitor["IfStatement:exit"]?.(if2);
    visitor["IfStatement:exit"]?.(if1);
    visitor["Program:exit"]?.(program);

    expect(report).not.toHaveBeenCalled();
  });

  it("should reset nesting in a standalone block", () => {
    const { report, visitor } = createRuleHarness(noNestedConditionalsRule, "no-nested-conditionals");

    const program = createProgram();
    const standaloneBlock = createBlockStatement(program);
    program.body.push(standaloneBlock as unknown as ESTree.Statement);

    const innerBlock2 = createBlockStatement();
    const if2 = createIfStatement("b", innerBlock2);

    const innerBlock1 = createBlockStatement();
    const if1 = createIfStatement("a", innerBlock1);
    appendStatement(innerBlock1, if2);

    appendStatement(standaloneBlock, if1);

    visitor.Program?.(program);
    visitor.BlockStatement?.(standaloneBlock);
    visitor.IfStatement?.(if1);
    visitor.IfStatement?.(if2);
    visitor["IfStatement:exit"]?.(if2);
    visitor["IfStatement:exit"]?.(if1);
    visitor["BlockStatement:exit"]?.(standaloneBlock);
    visitor["Program:exit"]?.(program);

    expect(report).not.toHaveBeenCalled();
  });

  it("should not count else-if as additional depth", () => {
    const { report, visitor } = createRuleHarness(noNestedConditionalsRule, "no-nested-conditionals");

    const program = createProgram();

    const innerBlock = createBlockStatement();
    const innerIf = createIfStatement("d", innerBlock);

    const elseIfBlock = createBlockStatement();
    const elseIf = createIfStatement("c", elseIfBlock);
    appendStatement(elseIfBlock, innerIf);

    const outerBlock = createBlockStatement();
    const outerIf = createIfStatement("a", outerBlock, elseIf);

    outerIf.parent = program;
    program.body.push(outerIf);

    visitor.Program?.(program);
    visitor.IfStatement?.(outerIf);
    visitor.IfStatement?.(elseIf);
    visitor.IfStatement?.(innerIf);
    visitor["IfStatement:exit"]?.(innerIf);
    visitor["IfStatement:exit"]?.(elseIf);
    visitor["IfStatement:exit"]?.(outerIf);
    visitor["Program:exit"]?.(program);

    expect(report).not.toHaveBeenCalled();
  });

  it("should count conditional expressions toward nesting", () => {
    const { report, visitor } = createRuleHarness(noNestedConditionalsRule, "no-nested-conditionals");

    const program = createProgram();

    // Structure: if1 > (conditionalExpr + if2 as siblings)
    // When visiting conditionalExpr then if2 while conditional is still open,
    // if2 should be at depth 3 (if1=1, conditional=2, if2=3)
    const block2 = createBlockStatement();
    const if2 = createIfStatement("b", block2);

    const conditionalExpr = createConditionalExpression("cond");

    const exprStmt = {
      type: "ExpressionStatement" as const,
      expression: conditionalExpr,
      parent: undefined as unknown as ESTree.Node,
      ...createSpan(),
    } as ESTree.ExpressionStatement;
    conditionalExpr.parent = exprStmt;

    const block1 = createBlockStatement();
    const if1 = createIfStatement("a", block1);
    appendStatement(block1, exprStmt);
    appendStatement(block1, if2);

    if1.parent = program;
    program.body.push(if1);

    // Visit order: enter conditional while in if1, then enter if2 while conditional is still active
    visitor.Program?.(program);
    visitor.IfStatement?.(if1); // depth: 1
    visitor.ConditionalExpression?.(conditionalExpr); // depth: 2 (at threshold, no report)
    visitor.IfStatement?.(if2); // depth: 3 (exceeds, reports)
    visitor["IfStatement:exit"]?.(if2); // depth: 2
    visitor["ConditionalExpression:exit"]?.(conditionalExpr); // depth: 1
    visitor["IfStatement:exit"]?.(if1); // depth: 0
    visitor["Program:exit"]?.(program);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ node: if2 }));
  });

  it("should respect configured maxDepth", () => {
    const { report, visitor } = createRuleHarness(noNestedConditionalsRule, "no-nested-conditionals", [
      { maxDepth: 1 },
    ]);

    const program = createProgram();

    const block2 = createBlockStatement();
    const if2 = createIfStatement("b", block2);

    const block1 = createBlockStatement();
    const if1 = createIfStatement("a", block1);
    appendStatement(block1, if2);

    if1.parent = program;
    program.body.push(if1);

    visitor.Program?.(program);
    visitor.IfStatement?.(if1);
    visitor.IfStatement?.(if2);
    visitor["IfStatement:exit"]?.(if2);
    visitor["IfStatement:exit"]?.(if1);
    visitor["Program:exit"]?.(program);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ node: if2 }));
  });
});
