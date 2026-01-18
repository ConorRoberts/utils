import { defineRule } from "oxlint";
import { EMOJI_REGEX as VALIBOT_EMOJI_REGEX } from "valibot";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

/**
 * Regex pattern to match emojis within a string
 * Based on valibot's EMOJI_REGEX but without anchors and with global flag
 */
const EMOJI_REGEX = new RegExp(
  VALIBOT_EMOJI_REGEX.source.slice(1, -1),
  "gu",
);

/**
 * Find emojis in a string
 * @param {string} text
 * @returns {RegExpMatchArray | null}
 */
const findEmojis = (text) => {
  return text.match(EMOJI_REGEX);
};

/**
 * Get a preview of the emoji found
 * @param {string} text
 * @returns {string}
 */
const getEmojiPreview = (text) => {
  const emojis = findEmojis(text);
  if (!emojis || emojis.length === 0) return "";

  const uniqueEmojis = [...new Set(emojis)];
  const preview = uniqueEmojis.slice(0, 3).join(" ");

  return uniqueEmojis.length > 3 ? `${preview} ...` : preview;
};

const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the use of emojis in code. Use icons from a component library instead.",
      recommended: true,
    },
    schema: [],
  },
  createOnce(context) {
    return /** @type {import("oxlint").VisitorWithHooks} */ ({
      /**
       * Check string literals
       * @param {ESTNode} node
       */
      StringLiteral(node) {
        if (node.type !== "StringLiteral") return;

        const emojis = findEmojis(node.value);
        if (emojis && emojis.length > 0) {
          const preview = getEmojiPreview(node.value);
          context.report({
            node,
            message: `Emojis are not allowed in code. Found: ${preview}. Use icons from a component library instead.`,
          });
        }
      },

      /**
       * Check template literals
       * @param {ESTNode} node
       */
      TemplateLiteral(node) {
        if (node.type !== "TemplateLiteral") return;

        // Check each quasi (template string part)
        for (const quasi of node.quasis) {
          if (quasi.type !== "TemplateElement") continue;

          const text = quasi.value.raw;
          const emojis = findEmojis(text);

          if (emojis && emojis.length > 0) {
            const preview = getEmojiPreview(text);
            context.report({
              node: quasi,
              message: `Emojis are not allowed in code. Found: ${preview}. Use icons from a component library instead.`,
            });
          }
        }
      },

      /**
       * Check JSX text
       * @param {ESTNode} node
       */
      JSXText(node) {
        if (node.type !== "JSXText") return;

        const emojis = findEmojis(node.value);
        if (emojis && emojis.length > 0) {
          const preview = getEmojiPreview(node.value);
          context.report({
            node,
            message: `Emojis are not allowed in code. Found: ${preview}. Use icons from a component library instead.`,
          });
        }
      },
    });
  },
});

export const noEmojiRule = rule;

