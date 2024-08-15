import { defineConfig } from "tsup";

export default defineConfig({
  format: ["esm", "cjs"],
  sourcemap: true,
  dts: true,
  clean: true,
  entry: {
    cache: "src/cache.ts",
    logger: "src/logger.ts",
    env: "src/env.ts",
    images: "src/images.ts",
  },
});
