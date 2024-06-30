import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate as runDrizzleMigrate } from "drizzle-orm/libsql/migrator";

export const migrate = async <TSchema extends Record<string, any>>(
  schema: TSchema,
  args: {
    url: string;
    token?: string;
    migrationsFolder: string;
  }
) => {
  let url = args.url;

  // Migrations are only supported via the libsql protocol
  if (url.startsWith("http")) {
    url = url.replace(/http(s)?/, "libsql");
  }

  const db = drizzle(
    createClient(
      // Auth token must be either 1) present and not undefined or 2) not present
      args.token
        ? {
            url,
            authToken: args.token,
          }
        : { url }
    ),
    { schema }
  );

  console.info("Running migrations");

  await runDrizzleMigrate(db, {
    migrationsFolder: args.migrationsFolder,
  });

  console.info("Migrations applied");
  process.exit(0);
};
