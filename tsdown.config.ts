import { defineConfig } from "tsdown";
import { copyFileSync, mkdirSync } from "node:fs";

export default defineConfig({
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  entry: {
    env: "src/env.ts",
    images: "src/images.ts",
    react: "src/react/index.ts",
    "oxlint/jsx-component-pascal-case": "src/oxlint-plugins/jsx-component-pascal-case.js",
    "oxlint/no-component-date-instantiation": "src/oxlint-plugins/no-component-date-instantiation.js",
    "oxlint/no-emoji": "src/oxlint-plugins/no-emoji.js",
    "oxlint/no-finally": "src/oxlint-plugins/no-finally.js",
    "oxlint/no-function-call-in-jsx": "src/oxlint-plugins/no-function-call-in-jsx.js",
    "oxlint/no-inline-components": "src/oxlint-plugins/no-inline-components.js",
    "oxlint/no-react-namespace": "src/oxlint-plugins/no-react-namespace.js",
    "oxlint/no-switch-plugin": "src/oxlint-plugins/no-switch-plugin.js",
    "oxlint/no-top-level-let": "src/oxlint-plugins/no-top-level-let.js",
    "oxlint/no-type-cast": "src/oxlint-plugins/no-type-cast.js",
  },
  onSuccess: async () => {
    const targetDir = "dist/oxlint";
    const targetFile = `${targetDir}/config.json`;

    mkdirSync(targetDir, { recursive: true });
    copyFileSync("src/oxlint-config.json", targetFile);

    console.log("✓ Copied oxlint-config.json to dist/oxlint/config.json");
  },
  external: ["react"],
});
