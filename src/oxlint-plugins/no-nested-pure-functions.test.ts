import { describe, expect, it } from "vitest";
import type { ESTree } from "oxlint";
import { noNestedPureFunctionsRule } from "./no-nested-pure-functions.js";
import {
	createFunctionBody,
	createIdentifier,
	createIdentifierReference,
	createRuleHarness,
	createSpan,
	createVariableDeclaration,
} from "./test-utils.js";

const createVariableDeclarator = (
	idName: string,
	init: ESTree.Expression | null,
): ESTree.VariableDeclarator => {
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
	body: ESTree.FunctionBody | ESTree.Expression,
): ESTree.ArrowFunctionExpression => {
	const arrowFunc = {
		type: "ArrowFunctionExpression" as const,
		params,
		body,
		expression: body.type !== "BlockStatement",
		async: false,
		generator: false,
		parent: undefined as unknown as ESTree.Node,
		...createSpan(),
	};

	const arrowFunction = arrowFunc as unknown as ESTree.ArrowFunctionExpression;
	body.parent = arrowFunction;

	for (const param of params) {
		param.parent = arrowFunction;
	}

	return arrowFunction;
};

const createCallExpression = (
	calleeName: string,
): ESTree.CallExpression => {
	const callee = createIdentifierReference(calleeName);
	const callExpr = {
		type: "CallExpression" as const,
		callee,
		arguments: [],
		optional: false,
		parent: undefined as unknown as ESTree.Node,
		...createSpan(),
	} as unknown as ESTree.CallExpression;

	callee.parent = callExpr;

	return callExpr;
};

const createExpressionStatement = (
	expression: ESTree.Expression,
): ESTree.ExpressionStatement => {
	const stmt = {
		type: "ExpressionStatement" as const,
		expression,
		parent: undefined as unknown as ESTree.Node,
		...createSpan(),
	} as unknown as ESTree.ExpressionStatement;

	expression.parent = stmt;

	return stmt;
};

describe("no-nested-pure-functions", () => {
	it("should report named pure function inside another function", () => {
		const { report, visitor } = createRuleHarness(
			noNestedPureFunctionsRule,
			"no-nested-pure-functions",
		);

		// const myFunc = () => {
		//   const someotherfunc = () => { return 42; }
		// }

		// Create outer function
		const outerFunctionBody = createFunctionBody();
		const outerFunction = createArrowFunctionExpression([], outerFunctionBody);
		outerFunctionBody.parent = outerFunction;

		// Create inner function body that returns a number
		const literal = {
			type: "Literal" as const,
			value: 42,
			raw: "42",
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.NumericLiteral;
		const returnStmt = {
			type: "ReturnStatement" as const,
			argument: literal,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.ReturnStatement;
		literal.parent = returnStmt;

		const innerFunctionBody = createFunctionBody();
		returnStmt.parent = innerFunctionBody;
		innerFunctionBody.body.push(returnStmt);

		// Create inner function
		const innerFunction = createArrowFunctionExpression(
			[],
			innerFunctionBody,
		);

		// Create variable declaration for inner function
		const innerVarDecl = createVariableDeclaration("const", outerFunctionBody);
		const innerDeclarator = createVariableDeclarator(
			"someotherfunc",
			innerFunction,
		);
		innerFunction.parent = innerDeclarator;
		innerDeclarator.parent = innerVarDecl;
		innerVarDecl.declarations.push(innerDeclarator);
		outerFunctionBody.body.push(innerVarDecl);

		// Create outer variable declarator
		const outerDeclarator = createVariableDeclarator("myFunc", outerFunction);
		outerFunction.parent = outerDeclarator;

		// Call the visitor
		visitor.VariableDeclarator?.(innerDeclarator);

		expect(report).toHaveBeenCalledTimes(1);
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({
				node: innerFunction,
				message: expect.stringContaining("someotherfunc"),
			}),
		);
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining("myFunc"),
			}),
		);
	});

	it("should not report impure functions (accessing outer scope)", () => {
		const { report, visitor } = createRuleHarness(
			noNestedPureFunctionsRule,
			"no-nested-pure-functions",
		);

		// const myFunc = () => {
		//   const x = 5;
		//   const useX = () => { return x; }
		// }

		// Create outer function
		const outerFunctionBody = createFunctionBody();
		const outerFunction = createArrowFunctionExpression([], outerFunctionBody);
		outerFunctionBody.parent = outerFunction;

		// Create x variable declaration
		const xLiteral = {
			type: "Literal" as const,
			value: 5,
			raw: "5",
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.NumericLiteral;
		const xVarDecl = createVariableDeclaration("const", outerFunctionBody);
		const xDeclarator = createVariableDeclarator("x", xLiteral);
		xLiteral.parent = xDeclarator;
		xDeclarator.parent = xVarDecl;
		xVarDecl.declarations.push(xDeclarator);
		outerFunctionBody.body.push(xVarDecl);

		// Create inner function that references x
		const xReference = createIdentifierReference("x");
		const returnStatement: ESTree.ReturnStatement = {
			type: "ReturnStatement",
			argument: xReference,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		};
		xReference.parent = returnStatement;

		const innerFunctionBody = createFunctionBody();
		returnStatement.parent = innerFunctionBody;
		innerFunctionBody.body.push(returnStatement);

		const innerFunction = createArrowFunctionExpression(
			[],
			innerFunctionBody,
		);

		// Create variable declaration for inner function
		const innerVarDecl = createVariableDeclaration("const", outerFunctionBody);
		const innerDeclarator = createVariableDeclarator("useX", innerFunction);
		innerFunction.parent = innerDeclarator;
		innerDeclarator.parent = innerVarDecl;
		innerVarDecl.declarations.push(innerDeclarator);
		outerFunctionBody.body.push(innerVarDecl);

		// Create outer variable declarator
		const outerDeclarator = createVariableDeclarator("myFunc", outerFunction);
		outerFunction.parent = outerDeclarator;

		// Call the visitor
		visitor.VariableDeclarator?.(innerDeclarator);

		// Should not report because useX is not pure (accesses x)
		expect(report).not.toHaveBeenCalled();
	});

	it("should not report functions at module scope", () => {
		const { report, visitor } = createRuleHarness(
			noNestedPureFunctionsRule,
			"no-nested-pure-functions",
		);

		// const helperFunc = () => { console.log("hi") }

		const consoleLog = createCallExpression("console.log");
		const functionBody = createFunctionBody();
		const consoleStmt = createExpressionStatement(consoleLog);
		consoleStmt.parent = functionBody;
		functionBody.body.push(consoleStmt);

		const func = createArrowFunctionExpression([], functionBody);

		const declarator = createVariableDeclarator("helperFunc", func);
		func.parent = declarator;

		// Call the visitor
		visitor.VariableDeclarator?.(declarator);

		// Should not report because there's no enclosing function
		expect(report).not.toHaveBeenCalled();
	});

	it("should not report anonymous callback functions (like in .map or .filter)", () => {
		const { report, visitor } = createRuleHarness(
			noNestedPureFunctionsRule,
			"no-nested-pure-functions",
		);

		// const myFunc = () => {
		//   return items.map(x => x * 2);
		// }

		// Create outer function
		const outerFunctionBody = createFunctionBody();
		const outerFunction = createArrowFunctionExpression([], outerFunctionBody);
		outerFunctionBody.parent = outerFunction;

		// Create the callback function: x => x * 2 (anonymous)
		const xParam = createIdentifier("x");
		const xRef1 = createIdentifierReference("x");
		const xRef2 = createIdentifierReference("x");

		const binaryExpr = {
			type: "BinaryExpression" as const,
			operator: "*",
			left: xRef1,
			right: {
				type: "Literal" as const,
				value: 2,
				raw: "2",
				parent: undefined as unknown as ESTree.Node,
				...createSpan(),
			} as unknown as ESTree.NumericLiteral,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.BinaryExpression;

		xRef1.parent = binaryExpr;
		(binaryExpr.right as ESTree.Node).parent = binaryExpr;

		// Create anonymous arrow function (no name, so won't be flagged)
		const callbackFunc = createArrowFunctionExpression(
			[xParam as ESTree.BindingPattern],
			binaryExpr,
		);
		binaryExpr.parent = callbackFunc;

		// Create .map call
		const itemsRef = createIdentifierReference("items");
		const mapProperty = createIdentifier("map");
		const mapMemberExpr = {
			type: "MemberExpression" as const,
			object: itemsRef,
			property: mapProperty,
			computed: false,
			optional: false,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.MemberExpression;

		itemsRef.parent = mapMemberExpr;
		mapProperty.parent = mapMemberExpr;

		const mapCallExpr = {
			type: "CallExpression" as const,
			callee: mapMemberExpr,
			arguments: [callbackFunc],
			optional: false,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.CallExpression;

		mapMemberExpr.parent = mapCallExpr;
		callbackFunc.parent = mapCallExpr;

		// Create return statement
		const returnStmt = {
			type: "ReturnStatement" as const,
			argument: mapCallExpr,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.ReturnStatement;

		mapCallExpr.parent = returnStmt;
		returnStmt.parent = outerFunctionBody;
		outerFunctionBody.body.push(returnStmt);

		// Create outer variable declarator
		const outerDeclarator = createVariableDeclarator("myFunc", outerFunction);
		outerFunction.parent = outerDeclarator;

		// The callback is anonymous (passed directly to .map), so there's no VariableDeclarator
		// to visit. The rule only triggers on VariableDeclarator nodes.

		// Should not report because the callback is anonymous
		expect(report).not.toHaveBeenCalled();
	});

	it("should report named callback functions assigned to variables", () => {
		const { report, visitor } = createRuleHarness(
			noNestedPureFunctionsRule,
			"no-nested-pure-functions",
		);

		// const myFunc = () => {
		//   const mapper = (x) => x * 2;  // This SHOULD be flagged
		//   return items.map(mapper);
		// }

		// Create outer function
		const outerFunctionBody = createFunctionBody();
		const outerFunction = createArrowFunctionExpression([], outerFunctionBody);
		outerFunctionBody.parent = outerFunction;

		// Create the mapper function: (x) => x * 2
		const xParam = createIdentifier("x");
		const xRef = createIdentifierReference("x");

		const binaryExpr = {
			type: "BinaryExpression" as const,
			operator: "*",
			left: xRef,
			right: {
				type: "Literal" as const,
				value: 2,
				raw: "2",
				parent: undefined as unknown as ESTree.Node,
				...createSpan(),
			} as unknown as ESTree.NumericLiteral,
			parent: undefined as unknown as ESTree.Node,
			...createSpan(),
		} as unknown as ESTree.BinaryExpression;

		xRef.parent = binaryExpr;
		(binaryExpr.right as ESTree.Node).parent = binaryExpr;

		const mapperFunc = createArrowFunctionExpression(
			[xParam as ESTree.BindingPattern],
			binaryExpr,
		);
		binaryExpr.parent = mapperFunc;

		// Create variable declaration for mapper
		const mapperVarDecl = createVariableDeclaration("const", outerFunctionBody);
		const mapperDeclarator = createVariableDeclarator("mapper", mapperFunc);
		mapperFunc.parent = mapperDeclarator;
		mapperDeclarator.parent = mapperVarDecl;
		mapperVarDecl.declarations.push(mapperDeclarator);
		outerFunctionBody.body.push(mapperVarDecl);

		// Create outer variable declarator
		const outerDeclarator = createVariableDeclarator("myFunc", outerFunction);
		outerFunction.parent = outerDeclarator;

		// Call the visitor on the mapper declarator
		visitor.VariableDeclarator?.(mapperDeclarator);

		// Should report because mapper is a named pure function
		expect(report).toHaveBeenCalledTimes(1);
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({
				node: mapperFunc,
				message: expect.stringContaining("mapper"),
			}),
		);
	});
});
