import type { AnyMySqlTable } from "drizzle-orm/mysql-core";

export type DrizzleSchema = Record<string, AnyMySqlTable>;
