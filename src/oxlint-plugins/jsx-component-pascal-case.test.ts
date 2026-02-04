import type { ESTree } from "oxlint/plugins";
import { assert, describe, expect, it } from "vitest";
import { jsxComponentPascalCaseRule } from "./jsx-component-pascal-case.js";
import { createFunctionBody, createIdentifier, createJSXElement, createRuleHarness, createSpan } from "./test-utils";

const createReturnStatement = (expression: ESTree.Expression): ESTree.ReturnStatement => {
  const ret = {
    type: "ReturnStatement" as const,
    argument: expression,
    ...createSpan(),
  };

  const returnStatement = ret as unknown as ESTree.ReturnStatement;
  expression.parent = returnStatement;

  return returnStatement;
};

const createFunctionDeclaration = (name: string): ESTree.Function => {
  const id = createIdentifier(name);
  const fn = {
    type: "FunctionDeclaration" as const,
    id,
    generator: false,
    async: false,
    params: [],
    body: createFunctionBody(),
    expression: false,
    ...createSpan(),
  };

  const functionNode = fn as unknown as ESTree.Function;
  id.parent = functionNode;
  const body = functionNode.body;
  if (body) {
    body.parent = functionNode;
  }

  return functionNode;
};

const createArrowFunctionExpression = (hasBody: boolean): ESTree.ArrowFunctionExpression => {
  const body = hasBody ? createFunctionBody() : createJSXElement();
  const arrow = {
    type: "ArrowFunctionExpression" as const,
    expression: !hasBody,
    async: false,
    params: [],
    body,
    id: null,
    generator: false,
    ...createSpan(),
  };

  const arrowNode = arrow as unknown as ESTree.ArrowFunctionExpression;
  body.parent = arrowNode;

  return arrowNode;
};

const createVariableDeclarator = (
  name: string,
  init: ESTree.Expression,
): { declarator: ESTree.VariableDeclarator; declaration: ESTree.VariableDeclaration } => {
  const id = createIdentifier(name);
  const declaration = {
    type: "VariableDeclaration" as const,
    kind: "const" as const,
    declarations: [],
    ...createSpan(),
  };

  const declarator = {
    type: "VariableDeclarator" as const,
    id,
    init,
    parent: declaration,
    ...createSpan(),
  };

  const declaratorNode = declarator as unknown as ESTree.VariableDeclarator;
  const declarationNode = declaration as unknown as ESTree.VariableDeclaration;
  id.parent = declaratorNode;
  init.parent = declaratorNode;
  declarationNode.declarations.push(declaratorNode);

  return { declarator: declaratorNode, declaration: declarationNode };
};

describe("jsx-component-pascal-case rule", () => {
  it("reports function declaration with camelCase that returns JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const fn = createFunctionDeclaration("myComponent");
    const body = fn.body;
    if (!body) {
      throw new Error("Function body is required");
    }

    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: fn,
        message: expect.stringContaining("myComponent"),
      }),
    );
  });

  it("allows function declaration with PascalCase that returns JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const fn = createFunctionDeclaration("MyComponent");
    const body = fn.body;
    if (!body) {
      throw new Error("Function body is required");
    }

    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows camelCase function that does not return JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const fn = createFunctionDeclaration("myHelper");
    const body = fn.body;
    if (!body) {
      throw new Error("Function body is required");
    }

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports arrow function with camelCase that returns JSX (expression body)", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const arrow = createArrowFunctionExpression(false);
    createVariableDeclarator("myComponent", arrow);

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    const exitFn = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(exitFn);
    exitFn(arrow);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: arrow,
        message: expect.stringContaining("myComponent"),
      }),
    );
  });

  it("reports arrow function with camelCase that returns JSX (block body)", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const arrow = createArrowFunctionExpression(true);
    createVariableDeclarator("myComponent", arrow);

    const body = arrow.body as ESTree.FunctionBody;
    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(exitFn);
    exitFn(arrow);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: arrow,
        message: expect.stringContaining("myComponent"),
      }),
    );
  });

  it("allows arrow function with PascalCase that returns JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const arrow = createArrowFunctionExpression(true);
    createVariableDeclarator("MyComponent", arrow);

    const body = arrow.body as ESTree.FunctionBody;
    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(exitFn);
    exitFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows anonymous arrow functions that return JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const arrow = createArrowFunctionExpression(false);

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    const exitFn = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(exitFn);
    exitFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports JSX fragment returns", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const fn = createFunctionDeclaration("myComponent");
    const body = fn.body;
    if (!body) {
      throw new Error("Function body is required");
    }

    const jsxFragment = {
      type: "JSXFragment" as const,
      openingFragment: {
        type: "JSXOpeningFragment" as const,
        ...createSpan(),
      },
      children: [],
      closingFragment: {
        type: "JSXClosingFragment" as const,
        ...createSpan(),
      },
      ...createSpan(),
    };

    const fragment = jsxFragment as unknown as ESTree.JSXFragment;
    const returnStatement = createReturnStatement(fragment);
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: fn,
        message: expect.stringContaining("myComponent"),
      }),
    );
  });

  it("allows functions used as object property values that return JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const arrow = createArrowFunctionExpression(false);

    const propertyKey = createIdentifier("tabBarIcon");
    const property = {
      type: "Property" as const,
      key: propertyKey,
      value: arrow,
      kind: "init" as const,
      method: false,
      shorthand: false,
      computed: false,
      ...createSpan(),
    };

    const objectProperty = property as unknown as ESTree.ObjectExpression["properties"][number];
    propertyKey.parent = objectProperty;
    arrow.parent = objectProperty;

    const objectExpression = {
      type: "ObjectExpression" as const,
      properties: [objectProperty],
      ...createSpan(),
    };

    const obj = objectExpression as unknown as ESTree.ObjectExpression;
    objectProperty.parent = obj;

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    const exitFn = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(exitFn);
    exitFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows higher-order components with 'with' prefix that return JSX", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const arrow = createArrowFunctionExpression(true);
    createVariableDeclarator("withAuth", arrow);

    const body = arrow.body as ESTree.FunctionBody;
    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(exitFn);
    exitFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports 'with' prefix without PascalCase continuation", () => {
    const { report, visitor } = createRuleHarness(jsxComponentPascalCaseRule, "jsx-component-pascal-case/test");

    const fn = createFunctionDeclaration("withauth");
    const body = fn.body;
    if (!body) {
      throw new Error("Function body is required");
    }

    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: fn,
        message: expect.stringContaining("withauth"),
      }),
    );
  });
});
