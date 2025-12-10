import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noReactNamespaceRule } from "./no-react-namespace.js";
import { createIdentifierReference, createRuleHarness, createSpan } from "./test-utils.js";

const createMemberExpression = (
  objectName: string,
  propertyName: string,
  parent?: ESTree.Node,
): ESTree.MemberExpression => {
  const object = createIdentifierReference(objectName);
  const property = createIdentifierReference(propertyName);

  const member = {
    type: "MemberExpression" as const,
    object,
    property,
    computed: false,
    optional: false,
    parent,
    ...createSpan(),
  };

  const memberExpression = member as unknown as ESTree.MemberExpression;
  object.parent = memberExpression;
  property.parent = memberExpression;

  return memberExpression;
};

const createCallExpression = (callee: ESTree.Expression, parent?: ESTree.Node): ESTree.CallExpression => {
  const call = {
    type: "CallExpression" as const,
    callee,
    arguments: [],
    optional: false,
    parent,
    ...createSpan(),
  };

  const callExpression = call as unknown as ESTree.CallExpression;
  callee.parent = callExpression;

  return callExpression;
};

const createTSTypeReference = (typeName: ESTree.Expression): ESTree.TSTypeReference => {
  const typeRef = {
    type: "TSTypeReference" as const,
    typeName,
    typeParameters: null,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const tsTypeReference = typeRef as unknown as ESTree.TSTypeReference;
  typeName.parent = tsTypeReference;

  return tsTypeReference;
};

describe("no-react-namespace rule", () => {
  it("reports React.useState usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "useState");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("useState"),
      }),
    );
  });

  it("reports React.useCallback usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "useCallback");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("useCallback"),
      }),
    );
  });

  it("reports React.useEffect usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "useEffect");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("useEffect"),
      }),
    );
  });

  it("reports React.useRef usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "useRef");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("useRef"),
      }),
    );
  });

  it("reports React.forwardRef usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "forwardRef");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("forwardRef"),
      }),
    );
  });

  it("reports React.memo usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "memo");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("memo"),
      }),
    );
  });

  it("reports React.createContext usage", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "createContext");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("createContext"),
      }),
    );
  });

  it("ignores non-React member expressions", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("SomeOther", "useState");

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows React namespace in type annotations", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "ComponentRef");
    createTSTypeReference(memberExpr);

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).not.toHaveBeenCalled();
  });

  it("allows React.FormEvent in type annotations", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "FormEvent");
    createTSTypeReference(memberExpr);

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).not.toHaveBeenCalled();
  });

  it("reports React.useState when used in call expression", () => {
    const { report, visitor } = createRuleHarness(noReactNamespaceRule, "no-react-namespace/test");

    const memberExpr = createMemberExpression("React", "useState");
    createCallExpression(memberExpr);

    assert.isDefined(visitor.MemberExpression);
    visitor.MemberExpression(memberExpr);

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        node: memberExpr,
        message: expect.stringContaining("useState"),
      }),
    );
  });
});
