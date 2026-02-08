import { parseArgs } from "node:util";
import { consola } from "consola";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";

const { values } = parseArgs({
  options: {
    "migrations-folder": { type: "string" },
    host: { type: "string" },
    username: { type: "string" },
    password: { type: "string" },
  },
  strict: true,
});

const migrationsFolder = values["migrations-folder"];

if (!migrationsFolder) {
  consola.error("Missing required argument: --migrations-folder");
  process.exit(1);
}

const host = values.host ?? String(process.env.DATABASE_HOST);
const username = values.username ?? String(process.env.DATABASE_USERNAME);
const password = values.password ?? String(process.env.DATABASE_PASSWORD);

const runMigration = async () => {
  consola.log("Running database migrations...");

  const db = drizzle({
    connection: { host, username, password },
  });

  try {
    await migrate(db, { migrationsFolder });
    consola.log("[OK] Migrations completed successfully!");
  } catch (error) {
    consola.error("[FAIL] Migration failed:", error);
    process.exit(1);
  }
};

runMigration().catch((error) => {
  consola.error("[FAIL] Migration script failed:", error);
  process.exit(1);
});
