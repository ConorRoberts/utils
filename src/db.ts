import { createClient } from "@libsql/client";
import { LibSQLDatabase, drizzle } from "drizzle-orm/libsql";

export const createLibsqlClient = (args: {
  url: string;
  authToken?: string;
}) => {
  return createClient(args);
};

export const createDbClient = <TSchema extends Record<string, unknown>>(
  schema: TSchema,
  args: { url: string; authToken?: string }
) => {
  const client = createLibsqlClient(args);
  const db = drizzle(client, {
    schema,
    logger: false,
  });

  return db;
};

export type DatabaseClient<TSchema extends Record<string, unknown>> =
  LibSQLDatabase<TSchema>;
export type DatabaseClientTransactionContext<
  TSchema extends Record<string, unknown>
> = Parameters<Parameters<DatabaseClient<TSchema>["transaction"]>[0]>[0];
