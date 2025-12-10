import { pipe } from "remeda";
import * as v from "valibot";

const PUBLIC_ENV_PREFIX = "PUBLIC_" as const;

/**
 * Validates your environment variables against the given Valibot schema;
 * @param args
 * @returns An object containing client environment variables and another containing server environment variables
 */
export const createEnv = <
  Schema extends Record<string, v.GenericSchema>,
  Env = {
    [K in keyof Schema]: v.InferOutput<Schema[K]>;
  },
>(args: {
  schema: Schema;
  // oxlint-disable-next-line no-explicit-any
  env: any;
}) => {
  const pairs = Object.entries(args.schema);
  const serverEnv = new Map();
  const invalidKeys: string[] = [];

  for (const [key, value] of pairs) {
    const result = v.safeParse(value, args.env[key] ?? null);

    if (!result.success) {
      invalidKeys.push(key);
    }

    serverEnv.set(key, result.output);
  }

  if (invalidKeys.length > 0) {
    console.error(`Invalid environment variable(s): ${invalidKeys.map((e) => `"${e}"`).join(", ")}`);
    process.exit(1);
  }

  type ClientEnvKeys = Exclude<
    {
      [K in keyof Env]: K extends `${typeof PUBLIC_ENV_PREFIX}${string}` ? K : never;
    }[keyof Env],
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

  return {
    client: clientEnv,
    server: Object.fromEntries(serverEnv.entries()) as Env,
  };
};
