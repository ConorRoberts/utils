import type { ESTree } from "oxlint";
import { assert, describe, expect, it } from "vitest";
import { prettyPropsRule } from "./pretty-props.js";
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

const createFunctionDeclaration = (name: string, params: unknown[]): ESTree.Function => {
  const id = createIdentifier(name);
  const fn = {
    type: "FunctionDeclaration" as const,
    id,
    generator: false,
    async: false,
    params,
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

  for (const param of params) {
    if (param && typeof param === "object" && "parent" in param) {
      (param as { parent: unknown }).parent = functionNode;
    }
  }

  return functionNode;
};

const createArrowFunctionExpression = (params: unknown[], hasBody: boolean): ESTree.ArrowFunctionExpression => {
  const body = hasBody ? createFunctionBody() : createJSXElement();
  const arrow = {
    type: "ArrowFunctionExpression" as const,
    expression: !hasBody,
    async: false,
    params,
    body,
    id: null,
    generator: false,
    ...createSpan(),
  };

  const arrowNode = arrow as unknown as ESTree.ArrowFunctionExpression;
  body.parent = arrowNode;

  for (const param of params) {
    if (param && typeof param === "object" && "parent" in param) {
      (param as { parent: unknown }).parent = arrowNode;
    }
  }

  return arrowNode;
};

const createObjectPattern = (properties: string[]) => {
  const pattern: Record<string, unknown> = {
    type: "ObjectPattern" as const,
    properties: [] as unknown[],
    ...createSpan(),
  };

  const props = properties.map((propName) => {
    const key = createIdentifier(propName);
    const value = createIdentifier(propName);

    const property: Record<string, unknown> = {
      type: "Property" as const,
      key,
      value,
      kind: "init" as const,
      method: false as const,
      shorthand: true as const,
      computed: false as const,
      parent: pattern,
      ...createSpan(),
    };

    (key as unknown as { parent: unknown }).parent = property;
    (value as unknown as { parent: unknown }).parent = property;

    return property;
  });

  pattern.properties = props;

  return pattern;
};

describe("pretty-props rule", () => {
  it("reports when props are destructured in function declaration", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const objectPattern = createObjectPattern(["title", "onPress"]);
    const fn = createFunctionDeclaration("MyComponent", [objectPattern]);
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

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: objectPattern,
        message: expect.stringContaining("should not be destructured"),
      }),
    );
  });

  it("reports when props are destructured in arrow function", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const objectPattern = createObjectPattern(["title", "onPress"]);
    const arrow = createArrowFunctionExpression([objectPattern], false);

    // Create a variable declarator parent to simulate: const MyComponent = ({ title }) => <View />
    const id = createIdentifier("MyComponent");
    const declarator = {
      type: "VariableDeclarator" as const,
      id,
      init: arrow,
      ...createSpan(),
    };
    (id as unknown as { parent: unknown }).parent = declarator;
    arrow.parent = declarator as unknown as ESTree.Node;

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: objectPattern,
        message: expect.stringContaining("should not be destructured"),
      }),
    );
  });

  it("reports when props parameter is not named 'props'", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const param = createIdentifier("properties");
    const fn = createFunctionDeclaration("MyComponent", [param]);
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

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: param,
        message: expect.stringContaining("should be named 'props', not 'properties'"),
      }),
    );
  });

  it("allows component with props parameter named 'props'", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const param = createIdentifier("props");
    const fn = createFunctionDeclaration("MyComponent", [param]);
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

    expect(report).not.toHaveBeenCalled();
  });

  it("allows arrow function component with props parameter named 'props'", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const param = createIdentifier("props");
    const arrow = createArrowFunctionExpression([param], true);
    const body = arrow.body as ESTree.FunctionBody;
    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    // Create a variable declarator parent to simulate: const MyComponent = (props) => { return <View /> }
    const id = createIdentifier("MyComponent");
    const declarator = {
      type: "VariableDeclarator" as const,
      id,
      init: arrow,
      ...createSpan(),
    };
    (id as unknown as { parent: unknown }).parent = declarator;
    arrow.parent = declarator as unknown as ESTree.Node;

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows non-component functions with any parameter name", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const param = createIdentifier("data");
    const fn = createFunctionDeclaration("myHelper", [param]);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows non-component functions with destructured parameters", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const objectPattern = createObjectPattern(["x", "y"]);
    const fn = createFunctionDeclaration("myHelper", [objectPattern]);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows component with no parameters", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const fn = createFunctionDeclaration("MyComponent", []);
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

    expect(report).not.toHaveBeenCalled();
  });

  it("reports when arrow function component with expression body has destructured props", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const objectPattern = createObjectPattern(["title"]);
    const arrow = createArrowFunctionExpression([objectPattern], false);

    // Create a variable declarator parent to simulate: const MyComponent = ({ title }) => <View />
    const id = createIdentifier("MyComponent");
    const declarator = {
      type: "VariableDeclarator" as const,
      id,
      init: arrow,
      ...createSpan(),
    };
    (id as unknown as { parent: unknown }).parent = declarator;
    arrow.parent = declarator as unknown as ESTree.Node;

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: objectPattern,
        message: expect.stringContaining("should not be destructured"),
      }),
    );
  });

  it("allows arrow function component with expression body and props parameter", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const param = createIdentifier("props");
    const arrow = createArrowFunctionExpression([param], false);

    // Create a variable declarator parent to simulate: const MyComponent = (props) => <View />
    const id = createIdentifier("MyComponent");
    const declarator = {
      type: "VariableDeclarator" as const,
      id,
      init: arrow,
      ...createSpan(),
    };
    (id as unknown as { parent: unknown }).parent = declarator;
    arrow.parent = declarator as unknown as ESTree.Node;

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports when function expression component has destructured props", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const objectPattern = createObjectPattern(["title"]);
    const fnExpr = {
      type: "FunctionExpression" as const,
      id: null,
      generator: false,
      async: false,
      params: [objectPattern],
      body: createFunctionBody(),
      expression: false,
      ...createSpan(),
    };

    const functionNode = fnExpr as unknown as ESTree.Function;
    const body = functionNode.body;
    if (!body) {
      throw new Error("Function body is required");
    }
    body.parent = functionNode;
    (objectPattern as unknown as { parent: unknown }).parent = functionNode;

    const returnStatement = createReturnStatement(createJSXElement());
    returnStatement.parent = body;
    body.body.push(returnStatement);

    // Create a variable declarator parent to simulate: const MyComponent = function({ title }) { return <View /> }
    const id = createIdentifier("MyComponent");
    const declarator = {
      type: "VariableDeclarator" as const,
      id,
      init: functionNode,
      ...createSpan(),
    };
    (id as unknown as { parent: unknown }).parent = declarator;
    functionNode.parent = declarator as unknown as ESTree.Node;

    const enterFn = visitor.FunctionExpression;
    assert.isDefined(enterFn);
    enterFn(functionNode);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: objectPattern,
        message: expect.stringContaining("should not be destructured"),
      }),
    );
  });

  it("allows render prop functions with destructured parameters (non-PascalCase)", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    // Simulates: ({ pressed }) => <View />
    const objectPattern = createObjectPattern(["pressed"]);
    const arrow = createArrowFunctionExpression([objectPattern], false);

    const enterFn = visitor.ArrowFunctionExpression;
    assert.isDefined(enterFn);
    enterFn(arrow);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows camelCase function that returns JSX", () => {
    const { report, visitor } = createRuleHarness(prettyPropsRule, "pretty-props/test");

    const param = createIdentifier("data");
    const fn = createFunctionDeclaration("myRenderer", [param]);
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

    expect(report).not.toHaveBeenCalled();
  });
});
