import { pino } from "pino";

export const createLogger = (args: {
  token?: string | undefined | null;
  pretty?: boolean;
  service: string;
}) => {
  const l = pino(
    {
      level: "info",
      redact: [],
      transport: args.pretty
        ? {
            target: "pino-pretty",
          }
        : undefined,
    },

    args.token
      ? pino.transport({
          target: "@logtail/pino",
          options: { sourceToken: args.token },
        })
      : undefined,
  );

  l.child({ service: args.service });

  return l;
};
