import { assert, describe, expect, it } from "vitest";

import type { ESTree } from "oxlint";

import { noEmojiRule } from "./no-emoji.js";
import { createRuleHarness, createSpan } from "./test-utils.js";

const createStringLiteral = (value: string): ESTree.StringLiteral => {
  const literal = {
    type: "StringLiteral" as const,
    value,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  return literal as unknown as ESTree.StringLiteral;
};

const createTemplateElement = (raw: string): ESTree.TemplateElement => {
  const element = {
    type: "TemplateElement" as const,
    value: {
      raw,
      cooked: raw,
    },
    tail: false,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  return element as unknown as ESTree.TemplateElement;
};

const createTemplateLiteral = (parts: string[]): ESTree.TemplateLiteral => {
  const quasis = parts.map((part) => createTemplateElement(part));

  const literal = {
    type: "TemplateLiteral" as const,
    quasis,
    expressions: [],
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  const templateLiteral = literal as unknown as ESTree.TemplateLiteral;

  for (const quasi of quasis) {
    quasi.parent = templateLiteral;
  }

  return templateLiteral;
};

const createJSXText = (value: string): ESTree.JSXText => {
  const text = {
    type: "JSXText" as const,
    value,
    parent: undefined as unknown as ESTree.Node,
    ...createSpan(),
  };

  return text as unknown as ESTree.JSXText;
};

describe("no-emoji rule", () => {
  describe("StringLiteral", () => {
    it("reports string with single emoji", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("Hello 👋 world");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          node: stringLiteral,
          message: expect.stringContaining("Use icons from a component library"),
        }),
      );
    });

    it("reports string with multiple emojis", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("🎉 Party time! 🎊🎈");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          node: stringLiteral,
          message: expect.stringContaining("🎉"),
        }),
      );
    });

    it("ignores string without emojis", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("Hello world");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).not.toHaveBeenCalled();
    });

    it("ignores empty string", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("TemplateLiteral", () => {
    it("reports template literal with emoji", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const templateLiteral = createTemplateLiteral(["Hello 🌍 world"]);

      assert.isDefined(visitor.TemplateLiteral);
      visitor.TemplateLiteral(templateLiteral);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Use icons from a component library"),
        }),
      );
    });

    it("reports template literal with emojis in multiple parts", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const templateLiteral = createTemplateLiteral(["Hello 👋", " world 🌍"]);

      assert.isDefined(visitor.TemplateLiteral);
      visitor.TemplateLiteral(templateLiteral);

      expect(report).toHaveBeenCalledTimes(2);
    });

    it("ignores template literal without emojis", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const templateLiteral = createTemplateLiteral(["Hello world"]);

      assert.isDefined(visitor.TemplateLiteral);
      visitor.TemplateLiteral(templateLiteral);

      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("JSXText", () => {
    it("reports JSX text with emoji", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const jsxText = createJSXText("Click here 👆");

      assert.isDefined(visitor.JSXText);
      visitor.JSXText(jsxText);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          node: jsxText,
          message: expect.stringContaining("Use icons from a component library"),
        }),
      );
    });

    it("reports JSX text with multiple emojis", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const jsxText = createJSXText("🔥 Hot deal! 💰💸");

      assert.isDefined(visitor.JSXText);
      visitor.JSXText(jsxText);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("🔥"),
        }),
      );
    });

    it("ignores JSX text without emojis", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const jsxText = createJSXText("Click here");

      assert.isDefined(visitor.JSXText);
      visitor.JSXText(jsxText);

      expect(report).not.toHaveBeenCalled();
    });

    it("ignores empty JSX text", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const jsxText = createJSXText("");

      assert.isDefined(visitor.JSXText);
      visitor.JSXText(jsxText);

      expect(report).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("handles string with only emojis", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("🎉🎊🎈");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).toHaveBeenCalledTimes(1);
    });

    it("handles various emoji types (faces, objects, symbols)", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("😀 📦 ✅ ⚠️");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).toHaveBeenCalledTimes(1);
    });

    it("catches emojis in game mode labels", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");

      assert.isDefined(visitor.StringLiteral);

      // Test each label that might contain emojis
      const labelsWithEmojis = [
        "⚔️ Bedwars",
        "🏝️ Skyblock",
        "🎮 Survival Games",
        "🌿 Vanilla",
      ];

      for (const label of labelsWithEmojis) {
        visitor.StringLiteral(createStringLiteral(label));
      }

      expect(report).toHaveBeenCalledTimes(4);
    });

    it("catches bed emoji (🛏️)", () => {
      const { report, visitor } = createRuleHarness(noEmojiRule, "no-emoji/test");
      const stringLiteral = createStringLiteral("🛏️ Bedwars");

      assert.isDefined(visitor.StringLiteral);
      visitor.StringLiteral(stringLiteral);

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("🛏"),
        }),
      );
    });
  });
});
