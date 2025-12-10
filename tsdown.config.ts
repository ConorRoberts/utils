import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  entry: {
    env: "src/env.ts",
    images: "src/images.ts",
    "oxlint/jsx-component-pascal-case": "src/oxlint-plugins/jsx-component-pascal-case.js",
    "oxlint/no-component-date-instantiation": "src/oxlint-plugins/no-component-date-instantiation.js",
    "oxlint/no-emoji": "src/oxlint-plugins/no-emoji.js",
    "oxlint/no-finally": "src/oxlint-plugins/no-finally.js",
    "oxlint/no-inline-components": "src/oxlint-plugins/no-inline-components.js",
    "oxlint/no-react-namespace": "src/oxlint-plugins/no-react-namespace.js",
    "oxlint/no-switch-plugin": "src/oxlint-plugins/no-switch-plugin.js",
    "oxlint/no-top-level-let": "src/oxlint-plugins/no-top-level-let.js",
    "oxlint/no-type-cast": "src/oxlint-plugins/no-type-cast.js",
  },
});
