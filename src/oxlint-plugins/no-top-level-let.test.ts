import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noTopLevelLetRule } from "./no-top-level-let.js";
import {
  createFunctionBody,
  createIdentifier,
  createRuleHarness,
  createSpan,
  createVariableDeclaration,
} from "./test-utils.js";

const createFunction = (name: string, type: ESTree.FunctionType = "FunctionDeclaration") => {
  const id = type === "FunctionDeclaration" ? createIdentifier(name) : null;
  const fn = {
    type,
    id,
    generator: false,
    async: false,
    params: [],
    body: null,
    expression: false,
    ...createSpan(),
  };

  const functionNode = fn as unknown as ESTree.Function;

  if (functionNode.id) {
    functionNode.id.parent = functionNode;
  }

  return functionNode;
};

const createBlockStatement = (parent: ESTree.Node | undefined): ESTree.BlockStatement => {
  const block = {
    type: "BlockStatement" as const,
    body: [],
    parent,
    ...createSpan(),
  };
  return block as unknown as ESTree.BlockStatement;
};

const createIfStatement = (parent: ESTree.Node, consequent: ESTree.Statement): ESTree.IfStatement => {
  const test = createIdentifier("condition");
  const statement: ESTree.IfStatement = {
    type: "IfStatement",
    test,
    consequent,
    alternate: null,
    parent,
    ...createSpan(),
  };

  test.parent = statement;

  return statement;
};

describe("no-top-level-let rule", () => {
  it("reports let in any function", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("SummaryCard");
    const block = createFunctionBody(fn);
    fn.body = block;
    const variable = createVariableDeclaration("let", block);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: variable,
      }),
    );
  });

  it("reports let in lowercase functions", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("helper");
    const block = createFunctionBody(fn);
    fn.body = block;
    const variable = createVariableDeclaration("let", block);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).toHaveBeenCalledTimes(1);
  });

  it("ignores const declarations", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("SummaryCard");
    const block = createFunctionBody(fn);
    fn.body = block;
    const variable = createVariableDeclaration("const", block);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports let declarations inside nested blocks", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("SummaryCard");
    const block = createFunctionBody(fn);
    fn.body = block;
    const innerBlock = createBlockStatement(undefined);
    const ifStatement = createIfStatement(block, innerBlock);
    innerBlock.parent = ifStatement;
    block.body.push(ifStatement);
    const variable = createVariableDeclaration("let", innerBlock);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).toHaveBeenCalledTimes(1);
  });

  it("reports let declarations inside loop bodies", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("processItems");
    const block = createFunctionBody(fn);
    fn.body = block;

    // Create a for loop inside the function
    const forLoop: ESTree.ForStatement = {
      type: "ForStatement",
      init: null,
      test: null,
      update: null,
      body: createBlockStatement(undefined),
      parent: block,
      ...createSpan(),
    };
    const loopBody = forLoop.body as ESTree.BlockStatement;
    loopBody.parent = forLoop;
    block.body.push(forLoop);

    const variable = createVariableDeclaration("let", loopBody);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).toHaveBeenCalledTimes(1);
  });

  it("allows let in for loop initializers", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("processItems");
    const block = createFunctionBody(fn);
    fn.body = block;

    // Create a for loop inside the function
    const forLoop: ESTree.ForStatement = {
      type: "ForStatement",
      init: null,
      test: null,
      update: null,
      body: createBlockStatement(undefined),
      parent: block,
      ...createSpan(),
    };
    const loopBody = forLoop.body as ESTree.BlockStatement;
    loopBody.parent = forLoop;
    block.body.push(forLoop);

    // Create a let declaration as the for loop initializer
    const variable = createVariableDeclaration("let", forLoop);
    forLoop.init = variable;

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows let in for-of loop initializers", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("processItems");
    const block = createFunctionBody(fn);
    fn.body = block;

    const forOfLoop: ESTree.ForOfStatement = {
      type: "ForOfStatement",
      await: false,
      left: null,
      right: createIdentifier("items"),
      body: createBlockStatement(undefined),
      parent: block,
      ...createSpan(),
    } as unknown as ESTree.ForOfStatement;

    const loopBody = forOfLoop.body as ESTree.BlockStatement;
    loopBody.parent = forOfLoop;
    block.body.push(forOfLoop);

    const variable = createVariableDeclaration("let", forOfLoop);
    forOfLoop.left = variable;

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows let in for-in loop initializers", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("processItems");
    const block = createFunctionBody(fn);
    fn.body = block;

    const forInLoop: ESTree.ForInStatement = {
      type: "ForInStatement",
      left: null,
      right: createIdentifier("obj"),
      body: createBlockStatement(undefined),
      parent: block,
      ...createSpan(),
    } as unknown as ESTree.ForInStatement;

    const loopBody = forInLoop.body as ESTree.BlockStatement;
    loopBody.parent = forInLoop;
    block.body.push(forInLoop);

    const variable = createVariableDeclaration("let", forInLoop);
    forInLoop.left = variable;

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports let at global scope", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const program: ESTree.Program = {
      type: "Program",
      body: [],
      sourceType: "module",
      parent: null,
      hashbang: null,
      comments: [],
      tokens: [],
      ...createSpan(),
    };
    const variable = createVariableDeclaration("let", program);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).toHaveBeenCalledTimes(1);
  });

  it("reports let in any function regardless of naming", () => {
    const { report, visitor } = createRuleHarness(noTopLevelLetRule, "no-top-level-let/test");
    const fn = createFunction("usesHelper");
    const block = createFunctionBody(fn);
    fn.body = block;
    const variable = createVariableDeclaration("let", block);

    assert.isDefined(visitor.VariableDeclaration);

    visitor.VariableDeclaration(variable);

    expect(report).toHaveBeenCalledTimes(1);
  });
});
