import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as v from "valibot";
import { createEnv } from "./env";

describe("createEnv", () => {
  let originalExit: typeof process.exit;
  let originalError: typeof console.error;

  beforeEach(() => {
    originalExit = process.exit;
    originalError = console.error;
    process.exit = vi.fn() as never;
    console.error = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
  });

  describe("basic functionality", () => {
    it("should return server and client env objects", () => {
      const schema = {
        DATABASE_URL: v.string(),
        PUBLIC_API_URL: v.string(),
      };

      const env = {
        DATABASE_URL: "postgres://localhost",
        PUBLIC_API_URL: "https://api.example.com",
      };

      const result = createEnv({ schema, env });

      expect(result).toHaveProperty("server");
      expect(result).toHaveProperty("client");
    });

    it("should validate environment variables against schema", () => {
      const schema = {
        PORT: v.pipe(
          v.string(),
          v.transform((s) => Number.parseInt(s)),
        ),
      };

      const env = {
        PORT: "3000",
      };

      const result = createEnv({ schema, env });

      expect(result.server.PORT).toBe(3000);
    });

    it("should handle missing environment variables", () => {
      const schema = {
        MISSING_VAR: v.optional(v.string()),
      };

      const env = {};

      const result = createEnv({ schema, env });

      // When a variable is missing, it's passed as null to safeParse
      // and optional fields validate null to undefined
      expect(result.server.MISSING_VAR).toBeUndefined();
    });
  });

  describe("public environment variables", () => {
    it("should include PUBLIC_ prefixed variables in client env", () => {
      const schema = {
        PUBLIC_API_URL: v.string(),
        PUBLIC_APP_NAME: v.string(),
      };

      const env = {
        PUBLIC_API_URL: "https://api.example.com",
        PUBLIC_APP_NAME: "MyApp",
      };

      const result = createEnv({ schema, env });

      expect(result.client).toEqual({
        PUBLIC_API_URL: "https://api.example.com",
        PUBLIC_APP_NAME: "MyApp",
      });
    });

    it("should exclude non-PUBLIC_ prefixed variables from client env", () => {
      const schema = {
        DATABASE_URL: v.string(),
        PUBLIC_API_URL: v.string(),
        SECRET_KEY: v.string(),
      };

      const env = {
        DATABASE_URL: "postgres://localhost",
        PUBLIC_API_URL: "https://api.example.com",
        SECRET_KEY: "secret123",
      };

      const result = createEnv({ schema, env });

      expect(result.client).toEqual({
        PUBLIC_API_URL: "https://api.example.com",
      });
      expect(result.client).not.toHaveProperty("DATABASE_URL");
      expect(result.client).not.toHaveProperty("SECRET_KEY");
    });

    it("should include all variables in server env", () => {
      const schema = {
        DATABASE_URL: v.string(),
        PUBLIC_API_URL: v.string(),
        SECRET_KEY: v.string(),
      };

      const env = {
        DATABASE_URL: "postgres://localhost",
        PUBLIC_API_URL: "https://api.example.com",
        SECRET_KEY: "secret123",
      };

      const result = createEnv({ schema, env });

      expect(result.server).toEqual({
        DATABASE_URL: "postgres://localhost",
        PUBLIC_API_URL: "https://api.example.com",
        SECRET_KEY: "secret123",
      });
    });
  });

  describe("validation errors", () => {
    it("should exit when validation fails", () => {
      const schema = {
        PORT: v.number(),
      };

      const env = {
        PORT: "not-a-number",
      };

      createEnv({ schema, env });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should log invalid variable names", () => {
      const schema = {
        PORT: v.number(),
        TIMEOUT: v.number(),
      };

      const env = {
        PORT: "invalid",
        TIMEOUT: "also-invalid",
      };

      createEnv({ schema, env });

      const errorCall = (console.error as any).mock.calls[0][0];
      expect(errorCall).toContain("Invalid environment variable(s):");
      expect(errorCall).toContain('"PORT"');
      expect(errorCall).toContain('"TIMEOUT"');
    });

    it("should log single invalid variable name", () => {
      const schema = {
        PORT: v.number(),
      };

      const env = {
        PORT: "invalid",
      };

      createEnv({ schema, env });

      const errorCall = (console.error as any).mock.calls[0][0];
      expect(errorCall).toBe('Invalid environment variable(s): "PORT"');
    });

    it("should handle multiple validation failures", () => {
      const schema = {
        VAR1: v.string(),
        VAR2: v.number(),
        VAR3: v.boolean(),
      };

      const env = {
        VAR1: "",
        VAR2: "not-a-number",
        VAR3: "not-a-boolean",
      };

      createEnv({ schema, env });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("schema transformations", () => {
    it("should apply transformations from schema", () => {
      const schema = {
        PORT: v.pipe(
          v.string(),
          v.transform((s) => Number.parseInt(s)),
        ),
      };

      const env = {
        PORT: "8080",
      };

      const result = createEnv({ schema, env });

      expect(result.server.PORT).toBe(8080);
      expect(typeof result.server.PORT).toBe("number");
    });

    it("should apply complex transformations", () => {
      const schema = {
        URLS: v.pipe(
          v.string(),
          v.transform((s) => s.split(",")),
        ),
      };

      const env = {
        URLS: "http://api1.com,http://api2.com",
      };

      const result = createEnv({ schema, env });

      expect(result.server.URLS).toEqual(["http://api1.com", "http://api2.com"]);
    });
  });

  describe("optional and nullable values", () => {
    it("should handle union of string and null for missing values", () => {
      const schema = {
        REQUIRED: v.string(),
        OPTIONAL: v.union([v.string(), v.null()]),
      };

      const env = {
        REQUIRED: "value",
      };

      const result = createEnv({ schema, env });

      expect(result.server.REQUIRED).toBe("value");
      // When a field is missing, it becomes null during validation
      // but Object.fromEntries doesn't include null values as keys
      expect(result.server).toHaveProperty("OPTIONAL");
    });

    it("should handle nullable fields", () => {
      const schema = {
        NULLABLE: v.nullable(v.string()),
      };

      const env = {
        NULLABLE: null,
      };

      const result = createEnv({ schema, env });

      expect(result.server.NULLABLE).toBeNull();
    });

    it("should handle required string fields with actual values", () => {
      const schema = {
        REQUIRED_STRING: v.string(),
      };

      const env = {
        REQUIRED_STRING: "my-value",
      };

      const result = createEnv({ schema, env });

      expect(result.server.REQUIRED_STRING).toBe("my-value");
    });
  });

  describe("empty schema", () => {
    it("should handle empty schema", () => {
      const schema = {};

      const env = {};

      const result = createEnv({ schema, env });

      expect(result.server).toEqual({});
      expect(result.client).toEqual({});
    });
  });

  describe("extra environment variables", () => {
    it("should ignore extra environment variables not in schema", () => {
      const schema = {
        DEFINED_VAR: v.string(),
      };

      const env = {
        DEFINED_VAR: "value",
        EXTRA_VAR: "should-be-ignored",
        ANOTHER_EXTRA: "also-ignored",
      };

      const result = createEnv({ schema, env });

      expect(result.server).toEqual({
        DEFINED_VAR: "value",
      });
      expect(result.server).not.toHaveProperty("EXTRA_VAR");
    });
  });

  describe("union types", () => {
    it("should handle union types in schema", () => {
      const schema = {
        NODE_ENV: v.union([v.literal("development"), v.literal("production")]),
      };

      const env = {
        NODE_ENV: "production",
      };

      const result = createEnv({ schema, env });

      expect(result.server.NODE_ENV).toBe("production");
    });

    it("should validate union types", () => {
      const schema = {
        NODE_ENV: v.union([v.literal("development"), v.literal("production")]),
      };

      const env = {
        NODE_ENV: "staging",
      };

      createEnv({ schema, env });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("type safety", () => {
    it("should infer correct types for client env", () => {
      const schema = {
        PUBLIC_API_URL: v.string(),
        PUBLIC_PORT: v.pipe(
          v.string(),
          v.transform((s) => Number.parseInt(s)),
        ),
      };

      const env = {
        PUBLIC_API_URL: "https://api.example.com",
        PUBLIC_PORT: "3000",
      };

      const result = createEnv({ schema, env });

      // TypeScript should know these types
      expect(typeof result.client.PUBLIC_API_URL).toBe("string");
      expect(typeof result.client.PUBLIC_PORT).toBe("number");
    });

    it("should infer correct types for server env", () => {
      const schema = {
        DATABASE_URL: v.string(),
        PORT: v.pipe(
          v.string(),
          v.transform((s) => Number.parseInt(s)),
        ),
        DEBUG: v.boolean(),
      };

      const env = {
        DATABASE_URL: "postgres://localhost",
        PORT: "5432",
        DEBUG: true,
      };

      const result = createEnv({ schema, env });

      // TypeScript should know these types
      expect(typeof result.server.DATABASE_URL).toBe("string");
      expect(typeof result.server.PORT).toBe("number");
      expect(typeof result.server.DEBUG).toBe("boolean");
    });
  });

  describe("mixed public and private", () => {
    it("should correctly separate public and private variables", () => {
      const schema = {
        DATABASE_URL: v.string(),
        DATABASE_PASSWORD: v.string(),
        PUBLIC_API_URL: v.string(),
        PUBLIC_FEATURE_FLAG: v.boolean(),
        API_SECRET: v.string(),
      };

      const env = {
        DATABASE_URL: "postgres://localhost",
        DATABASE_PASSWORD: "secret",
        PUBLIC_API_URL: "https://api.example.com",
        PUBLIC_FEATURE_FLAG: true,
        API_SECRET: "api-secret",
      };

      const result = createEnv({ schema, env });

      expect(result.client).toEqual({
        PUBLIC_API_URL: "https://api.example.com",
        PUBLIC_FEATURE_FLAG: true,
      });

      expect(result.server).toEqual({
        DATABASE_URL: "postgres://localhost",
        DATABASE_PASSWORD: "secret",
        PUBLIC_API_URL: "https://api.example.com",
        PUBLIC_FEATURE_FLAG: true,
        API_SECRET: "api-secret",
      });
    });
  });

  describe("validation with complex schemas", () => {
    it("should validate object schemas", () => {
      const schema = {
        DATABASE_CONFIG: v.object({
          url: v.string(),
          port: v.number(),
        }),
      };

      const env = {
        DATABASE_CONFIG: {
          url: "localhost",
          port: 5432,
        },
      };

      const result = createEnv({ schema, env });

      expect(result.server.DATABASE_CONFIG).toEqual({
        url: "localhost",
        port: 5432,
      });
    });

    it("should fail on invalid object schemas", () => {
      const schema = {
        DATABASE_CONFIG: v.object({
          url: v.string(),
          port: v.number(),
        }),
      };

      const env = {
        DATABASE_CONFIG: {
          url: "localhost",
          port: "not-a-number",
        },
      };

      createEnv({ schema, env });

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it("should handle array schemas", () => {
      const schema = {
        ALLOWED_HOSTS: v.array(v.string()),
      };

      const env = {
        ALLOWED_HOSTS: ["host1.com", "host2.com"],
      };

      const result = createEnv({ schema, env });

      expect(result.server.ALLOWED_HOSTS).toEqual(["host1.com", "host2.com"]);
    });
  });
});
