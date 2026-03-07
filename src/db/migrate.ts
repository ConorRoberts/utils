import { consola } from "consola";
import { sql } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import { migrate } from "drizzle-orm/planetscale-serverless/migrator";
import { getTableName } from "drizzle-orm/table";
import { resolve } from "node:path";
import type { DrizzleSchema } from "./types";

type SchemaTableName<TSchema extends DrizzleSchema> = TSchema[keyof TSchema]["_"]["name"];

interface MigrateConnectionOptions {
  migrationsFolder: string;
  host: string;
  username: string;
  password: string;
}

interface MigrateSharedOptions<TSchema extends DrizzleSchema> extends MigrateConnectionOptions {
  deleteOrder?: SchemaTableName<TSchema>[];
}

type CleanMigrateOptions<TSchema extends DrizzleSchema> = MigrateSharedOptions<TSchema> & {
  clean: true;
  schema: TSchema;
};

type StandardMigrateOptions<TSchema extends DrizzleSchema> = MigrateSharedOptions<TSchema> & {
  clean?: false;
  schema?: TSchema;
};

type MigrateOptions<TSchema extends DrizzleSchema = DrizzleSchema> =
  | CleanMigrateOptions<TSchema>
  | StandardMigrateOptions<TSchema>;

interface DeleteResult {
  table: string;
  rowsDeleted: number;
  success: boolean;
  error?: string;
}

const escapeIdentifier = (value: string): string => {
  return `\`${value.replaceAll("`", "``")}\``;
};

const parseError = (error: unknown): string => {
  if (error instanceof DrizzleQueryError) {
    if (error.cause instanceof Error) {
      return error.cause.message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const buildDeleteOrder = <TTableName extends string>(tableNames: TTableName[], preferredOrder: TTableName[]) => {
  const seen = new Set<string>();
  const ordered: TTableName[] = [];

  for (const tableName of preferredOrder) {
    if (seen.has(tableName)) {
      continue;
    }

    seen.add(tableName);

    if (tableNames.includes(tableName)) {
      ordered.push(tableName);
    }
  }

  for (const tableName of tableNames) {
    if (!seen.has(tableName)) {
      ordered.push(tableName);
    }
  }

  return ordered;
};

const listSchemaTables = <TSchema extends DrizzleSchema>(schema: TSchema): SchemaTableName<TSchema>[] => {
  const tableNames: Set<SchemaTableName<TSchema>> = new Set();
  const tables = Object.values(schema) as TSchema[keyof TSchema][];

  for (const table of tables) {
    const tableName = getTableName(table) as SchemaTableName<TSchema>;

    tableNames.add(tableName);
  }

  return Array.from(tableNames);
};

const deleteTableRows = async (db: ReturnType<typeof drizzle>, tableNames: string[]): Promise<DeleteResult[]> => {
  const results: DeleteResult[] = [];

  for (const tableName of tableNames) {
    try {
      const rowsDeleted = await db.$count(sql.raw(tableName));

      await db.execute(sql.raw(`DELETE FROM ${tableName}`));

      results.push({
        table: tableName,
        rowsDeleted,
        success: true,
      });

      const status = rowsDeleted > 0 ? `[OK] Deleted ${rowsDeleted} rows` : "[SKIP] Empty";
      consola.log(`${status.padEnd(30)} from ${tableName}`);
    } catch (error) {
      const errorDetails = parseError(error) || String(error);

      results.push({
        table: tableName,
        rowsDeleted: 0,
        success: false,
        error: errorDetails,
      });

      consola.error(`[FAIL] Failed to delete from ${tableName}: ${errorDetails}`);
      throw error;
    }
  }

  return results;
};

const dropTables = async (db: ReturnType<typeof drizzle>, tableNames: string[]): Promise<void> => {
  for (const tableName of tableNames) {
    try {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${escapeIdentifier(tableName)}`));
      consola.log(`[OK] Dropped table ${tableName}`);
    } catch (error) {
      const errorDetails = parseError(error) || String(error);
      consola.error(`[FAIL] Failed to drop ${tableName}: ${errorDetails}`);
      throw new Error(`Cannot proceed: failed to drop ${tableName}`);
    }
  }
};

const cleanDatabase = async (
  db: ReturnType<typeof drizzle>,
  options: CleanMigrateOptions<DrizzleSchema>,
): Promise<void> => {
  if (process.env.UNSAFE_CONFIRM_DELETE !== "true") {
    consola.error('Refusing to clean database. Set UNSAFE_CONFIRM_DELETE="true" to continue.');
    process.exit(1);
  }

  const tableNames = listSchemaTables(options.schema);

  if (tableNames.length === 0) {
    consola.log("Clean requested, but no tables were found in the provided Drizzle schema.");
    return;
  }

  const ordered = buildDeleteOrder(tableNames, options.deleteOrder ?? []);

  consola.warn("WARNING: This will delete and drop ALL tables from the database.");
  consola.log(`Database host: ${db.$client.config.host}`);

  consola.log("");
  consola.log("Deleting table rows in order...\n");

  const results = await deleteTableRows(db, ordered);

  consola.log("\nDropping tables in order...\n");
  await dropTables(db, ordered);

  const successCount = results.filter((result) => result.success).length;
  const totalRowsDeleted = results.reduce((sum, result) => sum + result.rowsDeleted, 0);

  consola.log("");
  consola.log("=".repeat(60));
  consola.log("SUMMARY");
  consola.log("=".repeat(60));
  consola.log(`Deletion phase: ${successCount} tables processed, ${totalRowsDeleted} rows deleted`);
  consola.success("Database is now empty and ready for migrations.");
};

const runMigrations = async <TSchema extends DrizzleSchema>(options: MigrateOptions<TSchema>) => {
  const db = drizzle({
    connection: {
      host: options.host,
      username: options.username,
      password: options.password,
    },
  });

  if (options.clean) {
    await cleanDatabase(db, options);
  }

  consola.log("Running database migrations...");
  await migrate(db, { migrationsFolder: resolve(options.migrationsFolder) });
  consola.log("[OK] Migrations completed successfully!");
};

export { runMigrations };
export type { DrizzleSchema, MigrateOptions, SchemaTableName };
