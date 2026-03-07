import { isTable } from "drizzle-orm";
import type { AnyMySqlTable } from "drizzle-orm/mysql-core";
import * as R from "remeda";

export const filterTables = <TSchema extends Record<string, AnyMySqlTable | unknown>>(schema: TSchema) => {
  return R.pipe(
    schema,
    R.entries(),
    R.map(([name, t]) => (isTable(t) ? ([name, t] as const) : null)),
    R.filter(R.isNonNull),
    R.fromEntries(),
  );
};
