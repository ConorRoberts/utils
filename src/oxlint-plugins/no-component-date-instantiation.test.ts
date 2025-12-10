import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noComponentDateInstantiationRule } from "./no-component-date-instantiation.js";
import {
  createRuleHarness,
  createSpan,
  createIdentifier,
  createIdentifierReference,
  createFunctionBody,
} from "./test-utils.js";

const createNewExpression = (calleeName: string): ESTree.NewExpression => {
  const callee = createIdentifierReference(calleeName);

  const newExpr = {
    type: "NewExpression" as const,
    callee,
    arguments: [],
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const newExpression = newExpr as unknown as ESTree.NewExpression;
  callee.parent = newExpression;

  return newExpression;
};

const createJSXElement = (name = "div"): ESTree.JSXElement => {
  const jsxIdentifier = {
    type: "JSXIdentifier" as const,
    name,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const openingElement = {
    type: "JSXOpeningElement" as const,
    name: jsxIdentifier,
    attributes: [],
    selfClosing: true,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const element = {
    type: "JSXElement" as const,
    openingElement,
    children: [],
    closingElement: null,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const jsxElement = element as unknown as ESTree.JSXElement;
  const jsxOpeningElement = openingElement as unknown as ESTree.JSXOpeningElement;
  const jsxId = jsxIdentifier as unknown as ESTree.JSXIdentifier;

  jsxOpeningElement.parent = jsxElement;
  jsxId.parent = jsxOpeningElement;

  return jsxElement;
};

const createReturnStatement = (argument: ESTree.Expression | null): ESTree.ReturnStatement => {
  const returnStmt = {
    type: "ReturnStatement" as const,
    argument,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const returnStatement = returnStmt as unknown as ESTree.ReturnStatement;

  if (argument) {
    argument.parent = returnStatement;
  }

  return returnStatement;
};

const createVariableDeclarator = (idName: string, init: ESTree.Expression | null): ESTree.VariableDeclarator => {
  const id = createIdentifier(idName);

  const declarator = {
    type: "VariableDeclarator" as const,
    id,
    init,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const variableDeclarator = declarator as unknown as ESTree.VariableDeclarator;

  id.parent = variableDeclarator;

  if (init) {
    init.parent = variableDeclarator;
  }

  return variableDeclarator;
};

const createArrowFunctionExpression = (
  body: ESTree.Expression | ESTree.FunctionBody,
): ESTree.ArrowFunctionExpression => {
  const arrowFn = {
    type: "ArrowFunctionExpression" as const,
    id: null,
    params: [],
    body,
    async: false,
    generator: false,
    expression: body.type !== "BlockStatement",
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const arrowFunction = arrowFn as unknown as ESTree.ArrowFunctionExpression;
  body.parent = arrowFunction;

  return arrowFunction;
};

const createFunctionDeclaration = (name: string, body: ESTree.FunctionBody): ESTree.Function => {
  const id = createIdentifier(name);

  const fnDecl = {
    type: "FunctionDeclaration" as const,
    id,
    params: [],
    body,
    async: false,
    generator: false,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const functionDeclaration = fnDecl as unknown as ESTree.Function;

  id.parent = functionDeclaration;
  body.parent = functionDeclaration;

  return functionDeclaration;
};

describe("no-component-date-instantiation rule", () => {
  describe("React component with Date in top scope", () => {
    it("reports Date instantiation in PascalCase function that returns JSX", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create JSX element
      const jsxElement = createJSXElement("div");

      // Create return statement with JSX
      const returnStatement = createReturnStatement(jsxElement);

      // Create function body with return statement
      const functionBody = createFunctionBody();
      returnStatement.parent = functionBody;

      // Create function declaration
      const functionDeclaration = createFunctionDeclaration("MyComponent", functionBody);

      // Create Date instantiation in top scope
      const dateInstantiation = createNewExpression("Date");
      dateInstantiation.parent = functionBody;

      // Call visitors in correct order
      const enterFn = visitor.FunctionDeclaration;
      assert.isDefined(enterFn);
      enterFn(functionDeclaration);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(dateInstantiation);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(returnStatement);

      const exitFn = visitor["FunctionDeclaration:exit"];
      assert.isDefined(exitFn);
      exitFn(functionDeclaration);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          node: dateInstantiation,
          message: expect.stringContaining("Avoid instantiating Date in the top scope of component 'MyComponent'"),
        }),
      );
    });

    it("reports Date instantiation in PascalCase arrow function component", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create JSX element
      const jsxElement = createJSXElement("div");

      // Create return statement with JSX
      const returnStatement = createReturnStatement(jsxElement);

      // Create function body
      const functionBody = createFunctionBody();
      returnStatement.parent = functionBody;

      // Create arrow function
      const arrowFunction = createArrowFunctionExpression(functionBody);

      // Create variable declarator with PascalCase name
      const variableDeclarator = createVariableDeclarator("MyComponent", arrowFunction);

      // Set up parent chain
      arrowFunction.parent = variableDeclarator;

      // Create Date instantiation in top scope
      const dateInstantiation = createNewExpression("Date");
      dateInstantiation.parent = functionBody;

      // Call visitors in correct order
      const enterFn = visitor.ArrowFunctionExpression;
      assert.isDefined(enterFn);
      enterFn(arrowFunction);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(dateInstantiation);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(returnStatement);

      const exitFn = visitor["ArrowFunctionExpression:exit"];
      assert.isDefined(exitFn);
      exitFn(arrowFunction);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          node: dateInstantiation,
          message: expect.stringContaining("Avoid instantiating Date in the top scope of component 'MyComponent'"),
        }),
      );
    });
  });

  describe("Ignores non-component functions", () => {
    it("ignores Date instantiation in camelCase function", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create JSX element
      const jsxElement = createJSXElement("div");

      // Create return statement with JSX
      const returnStatement = createReturnStatement(jsxElement);

      // Create function body
      const functionBody = createFunctionBody();
      returnStatement.parent = functionBody;

      // Create function declaration with camelCase name (not a component)
      const functionDeclaration = createFunctionDeclaration("myFunction", functionBody);

      // Create Date instantiation
      const dateInstantiation = createNewExpression("Date");
      dateInstantiation.parent = functionBody;

      // Call visitors in correct order
      const enterFn = visitor.FunctionDeclaration;
      assert.isDefined(enterFn);
      enterFn(functionDeclaration);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(dateInstantiation);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(returnStatement);

      const exitFn = visitor["FunctionDeclaration:exit"];
      assert.isDefined(exitFn);
      exitFn(functionDeclaration);

      expect(report).not.toHaveBeenCalled();
    });

    it("ignores Date instantiation in PascalCase function that does not return JSX", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create return statement with null (no JSX)
      const returnStatement = createReturnStatement(null);

      // Create function body
      const functionBody = createFunctionBody();
      returnStatement.parent = functionBody;

      // Create function declaration with PascalCase name
      const functionDeclaration = createFunctionDeclaration("MyFunction", functionBody);

      // Create Date instantiation
      const dateInstantiation = createNewExpression("Date");
      dateInstantiation.parent = functionBody;

      // Call visitors in correct order
      const enterFn = visitor.FunctionDeclaration;
      assert.isDefined(enterFn);
      enterFn(functionDeclaration);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(dateInstantiation);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(returnStatement);

      const exitFn = visitor["FunctionDeclaration:exit"];
      assert.isDefined(exitFn);
      exitFn(functionDeclaration);

      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("Ignores Date in nested scopes", () => {
    it("ignores Date instantiation inside nested function", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create JSX element
      const jsxElement = createJSXElement("div");

      // Create return statement with JSX for outer component
      const outerReturnStatement = createReturnStatement(jsxElement);

      // Create outer function body
      const outerFunctionBody = createFunctionBody();
      outerReturnStatement.parent = outerFunctionBody;

      // Create outer function declaration (component)
      const outerFunctionDeclaration = createFunctionDeclaration("MyComponent", outerFunctionBody);

      // Create inner function body
      const innerFunctionBody = createFunctionBody();

      // Create inner arrow function
      const innerArrowFunction = createArrowFunctionExpression(innerFunctionBody);
      innerArrowFunction.parent = outerFunctionBody;

      // Create Date instantiation inside inner function
      const dateInstantiation = createNewExpression("Date");
      dateInstantiation.parent = innerFunctionBody;

      // Call visitors in correct order
      const enterFunctionDecl = visitor.FunctionDeclaration;
      assert.isDefined(enterFunctionDecl);
      enterFunctionDecl(outerFunctionDeclaration);

      const enterArrowFn = visitor.ArrowFunctionExpression;
      assert.isDefined(enterArrowFn);
      enterArrowFn(innerArrowFunction);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(dateInstantiation);

      const exitArrowFn = visitor["ArrowFunctionExpression:exit"];
      assert.isDefined(exitArrowFn);
      exitArrowFn(innerArrowFunction);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(outerReturnStatement);

      const exitFunctionDecl = visitor["FunctionDeclaration:exit"];
      assert.isDefined(exitFunctionDecl);
      exitFunctionDecl(outerFunctionDeclaration);

      // Should not report because Date is inside a nested function, not top scope
      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("Ignores non-Date instantiations", () => {
    it("ignores other class instantiations", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create JSX element
      const jsxElement = createJSXElement("div");

      // Create return statement with JSX
      const returnStatement = createReturnStatement(jsxElement);

      // Create function body
      const functionBody = createFunctionBody();
      returnStatement.parent = functionBody;

      // Create function declaration
      const functionDeclaration = createFunctionDeclaration("MyComponent", functionBody);

      // Create instantiation of a different class
      const otherInstantiation = createNewExpression("MyClass");
      otherInstantiation.parent = functionBody;

      // Call visitors in correct order
      const enterFn = visitor.FunctionDeclaration;
      assert.isDefined(enterFn);
      enterFn(functionDeclaration);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(otherInstantiation);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(returnStatement);

      const exitFn = visitor["FunctionDeclaration:exit"];
      assert.isDefined(exitFn);
      exitFn(functionDeclaration);

      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("Arrow function with expression body", () => {
    it("detects component with arrow function that has JSX expression body", () => {
      const { report, visitor } = createRuleHarness(
        noComponentDateInstantiationRule,
        "no-component-date-instantiation/test",
      );

      // Create JSX element
      const jsxElement = createJSXElement("div");

      // Create return statement
      const returnStatement = createReturnStatement(jsxElement);

      // Create function body
      const functionBody = createFunctionBody();
      returnStatement.parent = functionBody;

      // Create arrow function with block body
      const blockArrowFunction = createArrowFunctionExpression(functionBody);

      // Create variable declarator with PascalCase name
      const blockVariableDeclarator = createVariableDeclarator("MyComponent", blockArrowFunction);
      blockArrowFunction.parent = blockVariableDeclarator;

      // Create Date instantiation
      const dateInstantiation = createNewExpression("Date");
      dateInstantiation.parent = functionBody;

      // Call visitors in correct order
      const enterFn = visitor.ArrowFunctionExpression;
      assert.isDefined(enterFn);
      enterFn(blockArrowFunction);

      const newExprVisitor = visitor.NewExpression;
      assert.isDefined(newExprVisitor);
      newExprVisitor(dateInstantiation);

      const returnVisitor = visitor.ReturnStatement;
      assert.isDefined(returnVisitor);
      returnVisitor(returnStatement);

      const exitFn = visitor["ArrowFunctionExpression:exit"];
      assert.isDefined(exitFn);
      exitFn(blockArrowFunction);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Move it inside an effect, event handler, or use useMemo/useCallback"),
        }),
      );
    });
  });
});
