import { defineConfig } from "tsup";

export default defineConfig({
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  entry: {
    env: "src/env.ts",
    images: "src/images.ts",
  },
});
