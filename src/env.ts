import { pipe } from "remeda";
import type { BaseSchema, Output } from "valibot";
import * as v from "valibot";

const PUBLIC_ENV_PREFIX = "PUBLIC_" as const;

/**
 * Validates your environment variables against the given Valibot schema;
 * @param args
 * @returns An object containing client environment variables and another containing server environment variables
 */
export const createEnv = <
  Schema extends Record<string, BaseSchema>,
  Env = {
    [K in keyof Schema]: Output<Schema[K]>;
  },
>(args: {
  schema: Schema;
  env: any;
}) => {
  const pairs = Object.entries(args.schema);
  const serverEnv = new Map();

  for (const [key, value] of pairs) {
    const result = v.safeParse(value, args.env[key] ?? null);

    if (!result.success) {
      console.error(`Environment variable "${key}" is invalid`);
      process.exit(1);
    }

    serverEnv.set(key, result.output);
  }

  type ClientEnvKeys = Exclude<
    { [K in keyof Env]: K extends `${typeof PUBLIC_ENV_PREFIX}${string}` ? K : never }[keyof Env],
    undefined
  >;

  type ClientEnv = {
    [B in ClientEnvKeys]: Env[B];
  };

  const clientEnv = pipe(
    serverEnv,
    (obj) => Array.from(obj.entries()),
    (pairs) => pairs.filter(([k]) => k.startsWith(PUBLIC_ENV_PREFIX)),
    (pairs) => Object.fromEntries(pairs),
  ) as ClientEnv;

  return { client: clientEnv, server: Object.fromEntries(serverEnv.entries()) as Env };
};
