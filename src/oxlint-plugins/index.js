import { definePlugin } from "oxlint";

import { jsxComponentPascalCaseRule } from "./jsx-component-pascal-case.js";
import { noComponentDateInstantiationRule } from "./no-component-date-instantiation.js";
import { noDeleteRule } from "./no-delete.js";
import { noEmojiRule } from "./no-emoji.js";
import { noFinallyRule } from "./no-finally.js";
import { noInlineComponentsRule } from "./no-inline-components.js";
import { noReactNamespaceRule } from "./no-react-namespace.js";
import { noSwitchRule } from "./no-switch-plugin.js";
import { noTopLevelLetRule } from "./no-top-level-let.js";
import { noTypeCastRule } from "./no-type-cast.js";
import { prettyPropsRule } from "./pretty-props.js";

const plugin = definePlugin({
  meta: {
    name: "conorroberts",
  },
  rules: {
    "jsx-component-pascal-case": jsxComponentPascalCaseRule,
    "no-component-date-instantiation": noComponentDateInstantiationRule,
    "no-delete": noDeleteRule,
    "no-emoji": noEmojiRule,
    "no-finally": noFinallyRule,
    "no-inline-components": noInlineComponentsRule,
    "no-react-namespace": noReactNamespaceRule,
    "no-switch": noSwitchRule,
    "no-top-level-let": noTopLevelLetRule,
    "no-type-cast": noTypeCastRule,
    "pretty-props": prettyPropsRule,
  },
});

export default plugin;
