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
    "oxlint/index": "src/oxlint-plugins/index.js",
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
