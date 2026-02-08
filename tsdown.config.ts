import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  entry: {
    env: "src/env.ts",
    images: "src/images.ts",
    db: "src/db/index.ts",
    react: "src/react/index.ts",
    "oxlint/index": "src/oxlint-plugins/index.js",
  },
  onSuccess: async () => {
    const copies = [
      { src: "src/oxlint-config.json", dest: "dist/oxlint/config.json" },
      { src: "src/oxfmt-config.json", dest: "dist/oxfmt/config.json" },
    ];

    for (const { src, dest } of copies) {
      const dir = dest.substring(0, dest.lastIndexOf("/"));
      mkdirSync(dir, { recursive: true });
      copyFileSync(src, dest);
      console.log(`✓ Copied ${src} to ${dest}`);
    }
  },
  external: ["react"],
});
