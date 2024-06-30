import { defineConfig } from "tsup";

export default defineConfig({
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  entry: {
    schema: "src/schema.ts",
    db: "src/db.ts",
    cache: "src/cache.ts",
    logger: "src/logger.ts",
    env: "src/env.ts",
    images: "src/images.ts",
  },
});
