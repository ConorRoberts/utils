import { describe, expect, it } from "vitest";
import type { ESTree } from "oxlint/plugins";
import { noComponentPureFunctionsRule } from "./no-component-pure-functions.js";
import {
  createFunctionBody,
  createIdentifier,
  createIdentifierReference,
  createRuleHarness,
  createSpan,
  createVariableDeclaration,
} from "./test-utils.js";

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
  params: ESTree.BindingPattern[],
  body: ESTree.Expression | ESTree.FunctionBody,
): ESTree.ArrowFunctionExpression => {
  const arrowFn = {
    type: "ArrowFunctionExpression" as const,
    id: null,
    params,
    body,
    async: false,
    generator: false,
    expression: body.type !== "BlockStatement",
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const arrowFunction = arrowFn as unknown as ESTree.ArrowFunctionExpression;
  body.parent = arrowFunction;

  for (const param of params) {
    param.parent = arrowFunction;
  }

  return arrowFunction;
};

const createLiteralExpression = (value: string): ESTree.StringLiteral => {
  return {
    type: "Literal",
    value,
    raw: `"${value}"`,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  } as unknown as ESTree.StringLiteral;
};

describe("no-component-pure-functions", () => {
  describe("basic structure tests", () => {
    it("should have correct meta information", () => {
      const meta = noComponentPureFunctionsRule.meta;
      if (!meta) throw new Error("meta is undefined");

      expect(meta.type).toBe("suggestion");
      expect(meta.docs?.description).toContain("pure functions");
      expect(meta.docs?.description).toContain("React components");
    });

    it("creates visitor with VariableDeclarator handler", () => {
      const { visitor } = createRuleHarness(noComponentPureFunctionsRule, "no-component-pure-functions/test");

      expect(visitor.VariableDeclarator).toBeDefined();
      expect(typeof visitor.VariableDeclarator).toBe("function");
    });
  });

  describe("reports pure functions inside components", () => {
    it("reports pure function inside React component", () => {
      const { report, visitor } = createRuleHarness(noComponentPureFunctionsRule, "no-component-pure-functions/test");

      // Create component function body
      const componentBody = createFunctionBody();

      // Create component function
      const componentFunction = createArrowFunctionExpression([], componentBody);

      // Create JSX element to make it a component
      const jsxElement = createJSXElement("div");
      const componentReturn = createReturnStatement(jsxElement);
      componentReturn.parent = componentBody;
      componentBody.body.push(componentReturn);

      // Create pure function body
      const pureBody = createFunctionBody();
      const statusParam = createIdentifier("status");
      const pureFunction = createArrowFunctionExpression([statusParam as ESTree.BindingPattern], pureBody);

      // Add a return statement to pure function
      const literalReturn = createLiteralExpression("bg-amber-500");
      const pureReturn = createReturnStatement(literalReturn);
      pureReturn.parent = pureBody;
      pureBody.body.push(pureReturn);

      // Create variable declaration for pure function
      const pureVarDecl = createVariableDeclaration("const", componentBody);
      const pureDeclarator = createVariableDeclarator("getStatusColor", pureFunction);
      pureFunction.parent = pureDeclarator;
      pureDeclarator.parent = pureVarDecl;
      pureVarDecl.declarations.push(pureDeclarator);
      componentBody.body.unshift(pureVarDecl); // Add to beginning of component body

      // Create component variable declarator
      const componentDeclarator = createVariableDeclarator("MyComponent", componentFunction);
      componentFunction.parent = componentDeclarator;

      // Call visitor
      visitor.VariableDeclarator?.(pureDeclarator);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          node: pureFunction,
          message: expect.stringContaining("Pure function 'getStatusColor'"),
        }),
      );
    });
  });

  describe("does not report impure functions", () => {
    it("does not report function that accesses component scope", () => {
      const { report, visitor } = createRuleHarness(noComponentPureFunctionsRule, "no-component-pure-functions/test");

      // Create component function body
      const componentBody = createFunctionBody();

      // Create component function
      const componentFunction = createArrowFunctionExpression([], componentBody);

      // Create JSX element to make it a component
      const jsxElement = createJSXElement("div");
      const componentReturn = createReturnStatement(jsxElement);
      componentReturn.parent = componentBody;
      componentBody.body.push(componentReturn);

      // Create function that accesses external variable
      const impureBody = createFunctionBody();
      const impureFunction = createArrowFunctionExpression([], impureBody);

      // Return statement that references external variable 'count'
      const externalRef = createIdentifierReference("count");
      const impureReturn = createReturnStatement(externalRef);
      impureReturn.parent = impureBody;
      impureBody.body.push(impureReturn);

      // Create variable declaration
      const impureVarDecl = createVariableDeclaration("const", componentBody);
      const impureDeclarator = createVariableDeclarator("getCount", impureFunction);
      impureFunction.parent = impureDeclarator;
      impureDeclarator.parent = impureVarDecl;
      impureVarDecl.declarations.push(impureDeclarator);
      componentBody.body.unshift(impureVarDecl);

      // Create component variable declarator
      const componentDeclarator = createVariableDeclarator("MyComponent", componentFunction);
      componentFunction.parent = componentDeclarator;

      // Call visitor
      visitor.VariableDeclarator?.(impureDeclarator);

      expect(report).not.toHaveBeenCalled();
    });

    it("does not report function that contains JSX", () => {
      const { report, visitor } = createRuleHarness(noComponentPureFunctionsRule, "no-component-pure-functions/test");

      // Create component function body
      const componentBody = createFunctionBody();

      // Create component function
      const componentFunction = createArrowFunctionExpression([], componentBody);

      // Create JSX element for component
      const jsxElement = createJSXElement("div");
      const componentReturn = createReturnStatement(jsxElement);
      componentReturn.parent = componentBody;
      componentBody.body.push(componentReturn);

      // Create function that returns JSX
      const jsxFunctionBody = createFunctionBody();
      const jsxFunction = createArrowFunctionExpression([], jsxFunctionBody);

      // Return JSX
      const innerJsx = createJSXElement("span");
      const jsxReturn = createReturnStatement(innerJsx);
      jsxReturn.parent = jsxFunctionBody;
      jsxFunctionBody.body.push(jsxReturn);

      // Create variable declaration
      const jsxVarDecl = createVariableDeclaration("const", componentBody);
      const jsxDeclarator = createVariableDeclarator("renderItem", jsxFunction);
      jsxFunction.parent = jsxDeclarator;
      jsxDeclarator.parent = jsxVarDecl;
      jsxVarDecl.declarations.push(jsxDeclarator);
      componentBody.body.unshift(jsxVarDecl);

      // Create component variable declarator
      const componentDeclarator = createVariableDeclarator("MyComponent", componentFunction);
      componentFunction.parent = componentDeclarator;

      // Call visitor
      visitor.VariableDeclarator?.(jsxDeclarator);

      expect(report).not.toHaveBeenCalled();
    });

    it("does not report functions outside components", () => {
      const { report, visitor } = createRuleHarness(noComponentPureFunctionsRule, "no-component-pure-functions/test");

      // Create standalone pure function (not in a component)
      const pureBody = createFunctionBody();
      const pureFunction = createArrowFunctionExpression([createIdentifier("x") as ESTree.BindingPattern], pureBody);
      const pureReturn = createReturnStatement(createIdentifierReference("x"));
      pureReturn.parent = pureBody;
      pureBody.body.push(pureReturn);

      const pureDeclarator = createVariableDeclarator("identity", pureFunction);
      pureFunction.parent = pureDeclarator;

      // Call visitor
      visitor.VariableDeclarator?.(pureDeclarator);

      expect(report).not.toHaveBeenCalled();
    });
  });
});
