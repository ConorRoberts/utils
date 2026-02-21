import { resolve } from "node:path";
import { consola } from "consola";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";

interface MigrateOptions {
  migrationsFolder: string;
  host: string;
  username: string;
  password: string;
}

const runMigration = async (options: MigrateOptions) => {
  consola.log("Running database migrations...");

  const db = drizzle({
    connection: {
      host: options.host,
      username: options.username,
      password: options.password,
    },
  });

  await migrate(db, { migrationsFolder: resolve(options.migrationsFolder) });
  consola.log("[OK] Migrations completed successfully!");
};

export { runMigration };
export type { MigrateOptions };
