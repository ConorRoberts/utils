import { defineRule } from "oxlint";

/** @typedef {import("oxlint").ESTree.Node} ESTNode */

/**
 * Regex pattern to match emojis
 * Covers most common emoji ranges in Unicode
 */
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{203C}\u{2049}\u{20E3}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2600}-\u{2604}\u{260E}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261D}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262A}\u{262E}-\u{262F}\u{2638}-\u{263A}\u{2640}\u{2642}\u{2648}-\u{2653}\u{265F}-\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267B}\u{267E}-\u{267F}\u{2692}-\u{2697}\u{2699}\u{269B}-\u{269C}\u{26A0}-\u{26A1}\u{26A7}\u{26AA}-\u{26AB}\u{26B0}-\u{26B1}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26C8}\u{26CE}\u{26CF}\u{26D1}\u{26D3}-\u{26D4}\u{26E9}-\u{26EA}\u{26F0}-\u{26F5}\u{26F7}-\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

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

export default {
  meta: { name: "no-emoji" },
  rules: { "no-emoji": rule },
};
