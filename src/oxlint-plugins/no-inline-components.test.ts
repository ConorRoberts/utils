import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noInlineComponentsRule } from "./no-inline-components.js";
import {
  createFunctionBody,
  createIdentifier,
  createIdentifierReference,
  createJSXElement,
  createJSXExpressionContainer,
  createJSXIdentifier,
  createRuleHarness,
  createSpan,
  createVariableDeclaration,
} from "./test-utils";

const createCallExpression = (calleeName: string, args: ESTree.Expression[]): ESTree.CallExpression => {
  const callee = createIdentifierReference(calleeName);
  const call = {
    type: "CallExpression" as const,
    callee,
    arguments: args,
    optional: false,
    ...createSpan(),
  };

  const callExpression = call as unknown as ESTree.CallExpression;
  callee.parent = callExpression;
  for (const arg of args) {
    arg.parent = callExpression;
  }

  return callExpression;
};

const requireFunctionBody = (fn: ESTree.Function): ESTree.FunctionBody => {
  if (!fn.body) {
    throw new Error("Test helper expected function.body to be defined.");
  }
  return fn.body;
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
  const body = requireFunctionBody(functionNode);
  body.parent = functionNode;

  return functionNode;
};

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

const createVariableDeclaratorWithJsx = (
  name: string,
  parent: ESTree.VariableDeclaration,
): ESTree.VariableDeclarator => {
  const id = createIdentifier(name);
  const init = createJSXElement();
  const declarator: ESTree.VariableDeclarator = {
    type: "VariableDeclarator",
    id,
    init,
    parent,
    ...createSpan(),
  };

  id.parent = declarator;
  init.parent = declarator;

  return declarator;
};

const createJsxAssignmentExpression = (name: string): ESTree.AssignmentExpression => {
  const left = createIdentifierReference(name);
  const right = createJSXElement();
  const assignment = {
    type: "AssignmentExpression" as const,
    operator: "=" as const,
    left,
    right,
    ...createSpan(),
  };

  const assignmentExpression = assignment as unknown as ESTree.AssignmentExpression;
  left.parent = assignmentExpression;
  right.parent = assignmentExpression;

  return assignmentExpression;
};

describe("no-inline-components rule", () => {
  it("reports a JSX-returning function nested inside another JSX-returning function", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const outer = createFunctionDeclaration("Outer");
    const outerBody = requireFunctionBody(outer);

    const inner = createFunctionDeclaration("Inner");
    inner.parent = outerBody;
    const innerBody = requireFunctionBody(inner);

    const innerReturn = createReturnStatement(createJSXElement());
    innerReturn.parent = innerBody;
    innerBody.body.push(innerReturn);

    const outerReturn = createReturnStatement(createJSXElement());
    outerReturn.parent = outerBody;
    outerBody.body.push(inner);
    outerBody.body.push(outerReturn);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(outer);
    enterFn(inner);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(innerReturn);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(inner);

    returnVisitor(outerReturn);
    exitFn(outer);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: inner,
        message: expect.stringContaining("Inner"),
      }),
    );
  });

  it("allows JSX-returning functions nested inside non-JSX-returning functions", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const outer = createFunctionDeclaration("Helper");
    const outerBody = requireFunctionBody(outer);

    const inner = createFunctionDeclaration("Inner");
    inner.parent = outerBody;
    const innerBody = requireFunctionBody(inner);

    const innerReturn = createReturnStatement(createJSXElement());
    innerReturn.parent = innerBody;
    innerBody.body.push(innerReturn);

    outerBody.body.push(inner);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(outer);
    enterFn(inner);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(innerReturn);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(inner);
    exitFn(outer);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports JSX stored in a local variable inside a JSX-returning function", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const fn = createFunctionDeclaration("Component");
    const body = requireFunctionBody(fn);

    const declaration = createVariableDeclaration("const", body);
    const declarator = createVariableDeclaratorWithJsx("view", declaration);
    declaration.declarations.push(declarator);

    const identifier = createIdentifierReference("view");
    const returnStatement = createReturnStatement(identifier);
    returnStatement.parent = body;

    body.body.push(declaration, returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(declarator);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: declarator.init,
        message: expect.stringContaining("view"),
      }),
    );
  });

  it("does not report JSX locals when the function does not return JSX", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const fn = createFunctionDeclaration("Helper");
    const body = requireFunctionBody(fn);

    const declaration = createVariableDeclaration("const", body);
    const declarator = createVariableDeclaratorWithJsx("view", declaration);
    declaration.declarations.push(declarator);
    body.body.push(declaration);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(declarator);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports assignment expressions that store JSX inside a JSX-returning function", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const fn = createFunctionDeclaration("Component");
    const body = requireFunctionBody(fn);

    const assignment = createJsxAssignmentExpression("content");
    const assignmentStatement: ESTree.ExpressionStatement = {
      type: "ExpressionStatement",
      expression: assignment,
      ...createSpan(),
      parent: body,
    };

    assignment.parent = assignmentStatement;

    const returnStatement = createReturnStatement(createIdentifierReference("content"));
    returnStatement.parent = body;

    body.body.push(assignmentStatement, returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(fn);

    const assignmentVisitor = visitor.AssignmentExpression;
    assert.isDefined(assignmentVisitor);
    assignmentVisitor(assignment);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(fn);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: assignment.right,
        message: expect.stringContaining("content"),
      }),
    );
  });

  it("reports nested JSX-returning functions even when the outer function returns stored JSX", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const outer = createFunctionDeclaration("Wrapper");
    const body = requireFunctionBody(outer);

    const declaration = createVariableDeclaration("const", body);
    const declarator = createVariableDeclaratorWithJsx("markup", declaration);
    declaration.declarations.push(declarator);

    const inner = createFunctionDeclaration("Inner");
    inner.parent = body;
    const innerBody = requireFunctionBody(inner);
    const innerReturn = createReturnStatement(createJSXElement("span"));
    innerReturn.parent = innerBody;
    innerBody.body.push(innerReturn);

    const outerReturn = createReturnStatement(createIdentifierReference("markup"));
    outerReturn.parent = body;

    body.body.push(declaration, inner, outerReturn);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(outer);
    enterFn(inner);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(innerReturn);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(inner);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(declarator);

    returnVisitor(outerReturn);
    exitFn(outer);

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        node: declarator.init,
        message: expect.stringContaining("markup"),
      }),
    );
    expect(report).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        node: inner,
        message: expect.stringContaining("Inner"),
      }),
    );
  });

  it("allows anonymous JSX-returning functions that are not assigned to identifiers", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const outer = createFunctionDeclaration("Component");
    const body = requireFunctionBody(outer);

    const anonymousArrow = {
      type: "ArrowFunctionExpression" as const,
      expression: true,
      async: false,
      params: [],
      body: createJSXElement(),
      id: null,
      generator: false,
      ...createSpan(),
    };

    const arrow = anonymousArrow as unknown as ESTree.ArrowFunctionExpression;
    arrow.body.parent = arrow;

    const call = createCallExpression("itemsMap", [arrow]);
    const callStatement: ESTree.ExpressionStatement = {
      type: "ExpressionStatement",
      expression: call,
      ...createSpan(),
      parent: body,
    };

    call.parent = callStatement;

    const returnStatement = createReturnStatement(createJSXElement("root"));
    returnStatement.parent = body;

    body.body.push(callStatement, returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(outer);

    const arrowVisitor = visitor.ArrowFunctionExpression;
    assert.isDefined(arrowVisitor);
    arrowVisitor(arrow);

    const arrowExit = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(arrowExit);
    arrowExit(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(outer);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows JSX-returning functions used inside JSX prop objects", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const outer = createFunctionDeclaration("Route");
    const body = requireFunctionBody(outer);

    const tabBarIconArrow = {
      type: "ArrowFunctionExpression" as const,
      expression: true,
      async: false,
      params: [],
      body: createJSXElement("IconSymbol"),
      id: null,
      generator: false,
      ...createSpan(),
    };

    const arrow = tabBarIconArrow as unknown as ESTree.ArrowFunctionExpression;
    arrow.body.parent = arrow;

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

    const optionsObject = {
      type: "ObjectExpression" as const,
      properties: [objectProperty],
      ...createSpan(),
    };

    const objectExpression = optionsObject as unknown as ESTree.ObjectExpression;
    objectProperty.parent = objectExpression;

    const attributeValue = createJSXExpressionContainer(objectExpression);
    objectExpression.parent = attributeValue;

    const optionsAttribute = {
      type: "JSXAttribute" as const,
      name: createJSXIdentifier("options"),
      value: attributeValue,
      ...createSpan(),
    };

    const jsxAttribute = optionsAttribute as unknown as ESTree.JSXAttribute;
    jsxAttribute.name.parent = jsxAttribute;
    attributeValue.parent = jsxAttribute;

    const tabsElement = createJSXElement("TabsScreen");
    tabsElement.openingElement.attributes.push(jsxAttribute);
    jsxAttribute.parent = tabsElement.openingElement;

    const returnStatement = createReturnStatement(tabsElement);
    returnStatement.parent = body;

    body.body.push(returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(outer);

    const arrowVisitor = visitor.ArrowFunctionExpression;
    assert.isDefined(arrowVisitor);
    arrowVisitor(arrow);

    const arrowExit = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(arrowExit);
    arrowExit(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(outer);

    expect(report).not.toHaveBeenCalled();
  });

  it("ignores JSX assignments that happen outside of functions", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const program = {
      type: "Program" as const,
      body: [],
      sourceType: "module" as const,
      hashbang: null,
      comments: [],
      ...createSpan(),
    };

    const programNode = program as unknown as ESTree.Program;

    const declaration = createVariableDeclaration("const", programNode);
    const declarator = createVariableDeclaratorWithJsx("view", declaration);

    programNode.body.push(declaration);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(declarator);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports JSX-returning callback functions defined inside components (e.g., useCallback)", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const component = createFunctionDeclaration("MediaUpload");
    const componentBody = requireFunctionBody(component);

    // Create arrow function that returns JSX
    const arrowFn = {
      type: "ArrowFunctionExpression" as const,
      expression: false,
      async: false,
      params: [],
      body: createFunctionBody(),
      id: null,
      generator: false,
      ...createSpan(),
    };

    const arrow = arrowFn as unknown as ESTree.ArrowFunctionExpression;
    const arrowBody = arrow.body as ESTree.FunctionBody;
    arrowBody.parent = arrow;

    // Arrow function returns JSX
    const arrowReturn = createReturnStatement(createJSXElement("MediaItem"));
    arrowReturn.parent = arrowBody;
    arrowBody.body.push(arrowReturn);

    // Create useCallback call with arrow function as first argument
    const useCallbackCall = createCallExpression("useCallback", [arrow]);
    arrow.parent = useCallbackCall;

    // Assign useCallback result to a variable
    const declaration = createVariableDeclaration("const", componentBody);
    const declarator = {
      type: "VariableDeclarator" as const,
      id: createIdentifier("getActiveMediaComponent"),
      init: useCallbackCall,
      parent: declaration,
      ...createSpan(),
    };
    useCallbackCall.parent = declarator as unknown as ESTree.Node;
    declarator.id.parent = declarator as unknown as ESTree.Node;
    declaration.declarations.push(declarator as unknown as ESTree.VariableDeclarator);

    // Component returns JSX
    const componentReturn = createReturnStatement(createJSXElement("div"));
    componentReturn.parent = componentBody;

    componentBody.body.push(declaration, componentReturn);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(component);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(declarator as unknown as ESTree.VariableDeclarator);

    const arrowVisitor = visitor.ArrowFunctionExpression;
    assert.isDefined(arrowVisitor);
    arrowVisitor(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(arrowReturn);

    const arrowExit = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(arrowExit);
    arrowExit(arrow);

    returnVisitor(componentReturn);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(component);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: arrow,
        message: expect.stringContaining("getActiveMediaComponent"),
      }),
    );
  });

  it("reports JSX-returning functions declared as IIFEs (immediately invoked function expressions)", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const component = createFunctionDeclaration("Component");
    const componentBody = requireFunctionBody(component);

    // Create arrow function that returns JSX
    const arrowFn = {
      type: "ArrowFunctionExpression" as const,
      expression: true,
      async: false,
      params: [],
      body: createJSXElement(),
      id: null,
      generator: false,
      ...createSpan(),
    };

    const arrow = arrowFn as unknown as ESTree.ArrowFunctionExpression;
    arrow.body.parent = arrow;

    // Create immediate invocation of the arrow function
    const iifeCall = createCallExpression("", []);
    iifeCall.callee = arrow;
    arrow.parent = iifeCall;

    const callStatement: ESTree.ExpressionStatement = {
      type: "ExpressionStatement",
      expression: iifeCall,
      ...createSpan(),
      parent: componentBody,
    };

    iifeCall.parent = callStatement;

    // Component returns JSX
    const componentReturn = createReturnStatement(createJSXElement("div"));
    componentReturn.parent = componentBody;

    componentBody.body.push(callStatement, componentReturn);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(component);

    const arrowVisitor = visitor.ArrowFunctionExpression;
    assert.isDefined(arrowVisitor);
    arrowVisitor(arrow);

    const arrowExit = visitor["ArrowFunctionExpression:exit"];
    assert.isDefined(arrowExit);
    arrowExit(arrow);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(componentReturn);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(component);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: arrow,
        message: expect.stringContaining("immediately invoked function expression"),
      }),
    );
  });

  it("reports when JSX is pushed into an array and that array is returned", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const component = createFunctionDeclaration("Component");
    const componentBody = requireFunctionBody(component);

    // Create array variable: const rows = []
    const arrayDeclaration = createVariableDeclaration("const", componentBody);
    const arrayDeclarator: ESTree.VariableDeclarator = {
      type: "VariableDeclarator",
      id: createIdentifier("rows"),
      init: {
        type: "ArrayExpression",
        elements: [],
        parent: null as unknown as ESTree.Node,
        ...createSpan(),
      } as unknown as ESTree.Expression,
      parent: arrayDeclaration,
      ...createSpan(),
    };
    const arrayInit = arrayDeclarator.init as ESTree.ArrayExpression;
    arrayInit.parent = arrayDeclarator as unknown as ESTree.Node;
    arrayDeclarator.id.parent = arrayDeclarator as unknown as ESTree.Node;
    arrayDeclaration.declarations.push(arrayDeclarator);

    // Create rows.push(<JSXElement />)
    const jsxArg = createJSXElement("View");
    const pushCall = {
      type: "CallExpression" as const,
      callee: {
        type: "MemberExpression" as const,
        object: createIdentifierReference("rows"),
        property: createIdentifier("push"),
        computed: false,
        optional: false,
        parent: null as unknown as ESTree.Node,
        ...createSpan(),
      } as unknown as ESTree.Expression,
      arguments: [jsxArg as unknown as ESTree.Expression],
      optional: false,
      parent: null as unknown as ESTree.Node,
      ...createSpan(),
    };

    const callExpression = pushCall as unknown as ESTree.CallExpression;
    const memberExpr = callExpression.callee as ESTree.MemberExpression;
    memberExpr.parent = callExpression;
    memberExpr.object.parent = memberExpr as unknown as ESTree.Node;
    memberExpr.property.parent = memberExpr as unknown as ESTree.Node;
    jsxArg.parent = callExpression;

    const pushStatement: ESTree.ExpressionStatement = {
      type: "ExpressionStatement",
      expression: callExpression,
      ...createSpan(),
      parent: componentBody,
    };
    callExpression.parent = pushStatement;

    // Return rows
    const returnStatement = createReturnStatement(createIdentifierReference("rows"));
    returnStatement.parent = componentBody;

    componentBody.body.push(arrayDeclaration, pushStatement, returnStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(component);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(arrayDeclarator);

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    const returnVisitor = visitor.ReturnStatement;
    assert.isDefined(returnVisitor);
    returnVisitor(returnStatement);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(component);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: callExpression,
        message: expect.stringContaining("rows"),
      }),
    );
  });

  it("does not report when JSX is pushed into an array but the function doesn't return JSX", () => {
    const { report, visitor } = createRuleHarness(noInlineComponentsRule, "no-inline-components/test");

    const helper = createFunctionDeclaration("Helper");
    const helperBody = requireFunctionBody(helper);

    // Create array variable: const rows = []
    const arrayDeclaration = createVariableDeclaration("const", helperBody);
    const arrayDeclarator: ESTree.VariableDeclarator = {
      type: "VariableDeclarator",
      id: createIdentifier("rows"),
      init: {
        type: "ArrayExpression",
        elements: [],
        parent: null as unknown as ESTree.Node,
        ...createSpan(),
      } as unknown as ESTree.Expression,
      parent: arrayDeclaration,
      ...createSpan(),
    };
    const arrayInit = arrayDeclarator.init as ESTree.ArrayExpression;
    arrayInit.parent = arrayDeclarator as unknown as ESTree.Node;
    arrayDeclarator.id.parent = arrayDeclarator as unknown as ESTree.Node;
    arrayDeclaration.declarations.push(arrayDeclarator);

    // Create rows.push(<JSXElement />)
    const jsxArg = createJSXElement("View");
    const pushCall = {
      type: "CallExpression" as const,
      callee: {
        type: "MemberExpression" as const,
        object: createIdentifierReference("rows"),
        property: createIdentifier("push"),
        computed: false,
        optional: false,
        parent: null as unknown as ESTree.Node,
        ...createSpan(),
      } as unknown as ESTree.Expression,
      arguments: [jsxArg as unknown as ESTree.Expression],
      optional: false,
      parent: null as unknown as ESTree.Node,
      ...createSpan(),
    };

    const callExpression = pushCall as unknown as ESTree.CallExpression;
    const memberExpr = callExpression.callee as ESTree.MemberExpression;
    memberExpr.parent = callExpression;
    memberExpr.object.parent = memberExpr as unknown as ESTree.Node;
    memberExpr.property.parent = memberExpr as unknown as ESTree.Node;
    jsxArg.parent = callExpression;

    const pushStatement: ESTree.ExpressionStatement = {
      type: "ExpressionStatement",
      expression: callExpression,
      ...createSpan(),
      parent: helperBody,
    };
    callExpression.parent = pushStatement;

    helperBody.body.push(arrayDeclaration, pushStatement);

    const enterFn = visitor.FunctionDeclaration;
    assert.isDefined(enterFn);
    enterFn(helper);

    const variableVisitor = visitor.VariableDeclarator;
    assert.isDefined(variableVisitor);
    variableVisitor(arrayDeclarator);

    const callVisitor = visitor.CallExpression;
    assert.isDefined(callVisitor);
    callVisitor(callExpression);

    const exitFn = visitor["FunctionDeclaration:exit"];
    assert.isDefined(exitFn);
    exitFn(helper);

    expect(report).not.toHaveBeenCalled();
  });
});
