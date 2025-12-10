import { vi } from "vitest";

import type { Context, CreateOnceRule, CreateRule, ESTree, Rule, SourceCode } from "oxlint";

export const createSpan = () => ({
  start: 0,
  end: 0,
  range: [0, 0] satisfies [number, number],
  loc: {
    start: { line: 1, column: 0 },
    end: { line: 1, column: 0 },
  },
});

export const createIdentifier = (name: string): ESTree.BindingIdentifier => {
  const identifier = {
    type: "Identifier" as const,
    name,
    ...createSpan(),
  };

  return identifier as unknown as ESTree.BindingIdentifier;
};

export const createIdentifierReference = (name: string): ESTree.IdentifierReference => {
  const identifier = {
    type: "Identifier" as const,
    name,
    ...createSpan(),
  };

  return identifier as unknown as ESTree.IdentifierReference;
};

export const createJSXIdentifier = (name: string): ESTree.JSXIdentifier => {
  const identifier = {
    type: "JSXIdentifier" as const,
    name,
    ...createSpan(),
  };

  return identifier as unknown as ESTree.JSXIdentifier;
};

export const createJSXElement = (name = "div"): ESTree.JSXElement => {
  const openingElement = {
    type: "JSXOpeningElement" as const,
    name: createJSXIdentifier(name),
    attributes: [],
    selfClosing: true,
    ...createSpan(),
  };

  const element = {
    type: "JSXElement" as const,
    openingElement,
    children: [],
    closingElement: null,
    ...createSpan(),
  };

  const jsxElement = element as unknown as ESTree.JSXElement;
  const jsxOpeningElement = openingElement as unknown as ESTree.JSXOpeningElement;

  jsxOpeningElement.parent = jsxElement;
  jsxOpeningElement.name.parent = jsxOpeningElement;

  return jsxElement;
};

export const createJSXExpressionContainer = (expression: ESTree.Expression): ESTree.JSXExpressionContainer => {
  const container = {
    type: "JSXExpressionContainer" as const,
    expression,
    ...createSpan(),
  };

  const jsxContainer = container as unknown as ESTree.JSXExpressionContainer;
  expression.parent = jsxContainer;

  return jsxContainer;
};

export const createFunctionBody = (parent?: ESTree.Function | ESTree.ArrowFunctionExpression): ESTree.FunctionBody => {
  const body = {
    type: "BlockStatement" as const,
    body: [],
    ...createSpan(),
  };

  const functionBody = body as unknown as ESTree.FunctionBody;

  if (parent) {
    functionBody.parent = parent;
  }

  return functionBody;
};

export const createVariableDeclaration = (
  kind: ESTree.VariableDeclaration["kind"],
  parent: ESTree.Node | ESTree.FunctionBody,
): ESTree.VariableDeclaration => ({
  type: "VariableDeclaration",
  kind,
  declarations: [],
  parent,
  ...createSpan(),
});

type RuleVisitor = ReturnType<CreateRule["create"]> | ReturnType<CreateOnceRule["createOnce"]>;
type RuleContext = Pick<Context, "id" | "options" | "report">;

export const createRuleHarness = (rule: Rule, id: string) => {
  const report: RuleContext["report"] = vi.fn();
  const context: RuleContext = {
    id,
    options: [],
    report,
  };

  const visitor = getRuleVisitor(rule, context);

  return { report, visitor };
};

const hasCreate = (rule: Rule): rule is CreateRule => typeof rule.create === "function";
const hasCreateOnce = (rule: Rule): rule is CreateOnceRule =>
  "createOnce" in rule && typeof rule.createOnce === "function";

const createOxlintContext = (context: RuleContext): Context => {
  const stub = {
    get id(): string {
      return context.id;
    },
    get filename(): string {
      return "";
    },
    get physicalFilename(): string {
      return "";
    },
    get cwd(): undefined {
      return undefined;
    },
    get options(): Context["options"] {
      return context.options;
    },
    get sourceCode(): SourceCode {
      throw new Error("sourceCode stub is not available in the test harness.");
    },
    report(diagnostic: Parameters<RuleContext["report"]>[0]) {
      return context.report(diagnostic);
    },
  };

  // @ts-expect-error - Oxlint's Context carries private state we cannot initialize in tests.
  return stub;
};

const getRuleVisitor = (rule: Rule, context: RuleContext): RuleVisitor => {
  const oxlintContext = createOxlintContext(context);

  if (hasCreate(rule)) {
    return rule.create(oxlintContext);
  }

  if (hasCreateOnce(rule)) {
    return rule.createOnce(oxlintContext);
  }

  throw new Error("Rule must provide a create or createOnce hook.");
};
