/**
 * Database Schema Validator
 *
 * This script validates the database schema by analyzing all MySQL table definitions
 * from Drizzle migration metadata and reports any table, column, or constraint names
 * that exceed MySQL's maximum length limits.
 *
 * MySQL Limits:
 * - Table/Column names: 64 characters
 * - Constraint names: 64 characters
 *
 * Usage:
 * - Basic: pnpm -F scripts validate:db-schema
 * - Verbose: pnpm -F scripts validate:db-schema -- --verbose
 *
 * The verbose mode shows all constraint names being checked, sorted by length.
 *
 * This validation runs automatically:
 * - After `pnpm generate` (blocks if violations found)
 * - In CI/CD as part of PR checks
 */

import { consola } from "consola";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface NameLengthIssue {
  type: "table" | "column" | "constraint";
  tableName: string;
  name: string;
  actualLength: number;
  maxLength: number;
  constraintType?: "foreign_key" | "primary_key" | "unique" | "index";
}

interface IndexWidthIssue {
  type: "index_width";
  tableName: string;
  name: string;
  keyType: "primary_key" | "unique" | "index";
  actualBytes: number;
  maxBytes: number;
  columns: string[];
}

type ValidationIssue = NameLengthIssue | IndexWidthIssue;

interface DrizzleSnapshot {
  tables: Record<string, DrizzleTable>;
}

interface DrizzleTable {
  name: string;
  columns: Record<string, DrizzleColumn>;
  indexes: Record<string, DrizzleIndex>;
  foreignKeys: Record<string, DrizzleForeignKey>;
  compositePrimaryKeys: Record<string, DrizzlePrimaryKey>;
  uniqueConstraints: Record<string, DrizzleUniqueConstraint>;
}

interface DrizzleColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  autoincrement: boolean;
}

interface DrizzleIndex {
  name: string;
  columns: string[];
  isUnique?: boolean;
}

interface DrizzleForeignKey {
  name: string;
  tableFrom: string;
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
}

interface DrizzlePrimaryKey {
  name: string;
  columns: string[];
}

interface DrizzleUniqueConstraint {
  name: string;
  columns: string[];
}

const MAX_IDENTIFIER_LENGTH = 64;
const MAX_CONSTRAINT_NAME_LENGTH = 64;
const MYSQL_MAX_INDEX_BYTES = 3072;
const UTF8MB4_BYTES_PER_CHAR = 4;

const getLatestSnapshot = (metaDir: string): DrizzleSnapshot => {
  const resolvedMetaDir = resolve(metaDir);

  // Read the journal to find the latest migration
  const journalPath = join(resolvedMetaDir, "_journal.json");
  const parsedJournal = JSON.parse(readFileSync(journalPath, "utf-8"));

  interface JournalEntry {
    tag: string;
    idx: number;
  }

  const entries: JournalEntry[] = parsedJournal.entries;
  const latestEntry = entries[entries.length - 1];

  if (!latestEntry) {
    throw new Error("No migrations found in journal");
  }

  // Read the latest snapshot
  const snapshotPath = join(resolvedMetaDir, `${latestEntry.idx.toString().padStart(4, "0")}_snapshot.json`);
  const parsedSnapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
  const snapshot: DrizzleSnapshot = parsedSnapshot;

  return snapshot;
};

interface ValidateDatabaseSchemaOptions {
  metaDir: string;
  verbose?: boolean;
  exitOnComplete?: boolean;
}

const getTypeByteLength = (columnType: string): number => {
  const normalizedType = columnType.toLowerCase().trim();

  const varcharMatch = normalizedType.match(/^varchar\((\d+)\)$/);
  if (varcharMatch) {
    return Number(varcharMatch[1]) * UTF8MB4_BYTES_PER_CHAR;
  }

  const charMatch = normalizedType.match(/^char\((\d+)\)$/);
  if (charMatch) {
    return Number(charMatch[1]) * UTF8MB4_BYTES_PER_CHAR;
  }

  const varbinaryMatch = normalizedType.match(/^varbinary\((\d+)\)$/);
  if (varbinaryMatch) {
    return Number(varbinaryMatch[1]);
  }

  const binaryMatch = normalizedType.match(/^binary\((\d+)\)$/);
  if (binaryMatch) {
    return Number(binaryMatch[1]);
  }

  if (normalizedType.startsWith("tinyint")) return 1;
  if (normalizedType.startsWith("smallint")) return 2;
  if (normalizedType.startsWith("mediumint")) return 3;
  if (normalizedType.startsWith("int")) return 4;
  if (normalizedType.startsWith("bigint")) return 8;
  if (normalizedType.startsWith("date")) return 3;
  if (normalizedType.startsWith("datetime")) return 8;
  if (normalizedType.startsWith("timestamp")) return 4;

  if (normalizedType.includes("text") || normalizedType === "json" || normalizedType.includes("blob")) {
    return Number.POSITIVE_INFINITY;
  }

  return 0;
};

const getKeyTypeLabel = (keyType: IndexWidthIssue["keyType"]): string => {
  if (keyType === "primary_key") return "Primary Keys";
  if (keyType === "unique") return "Unique Indexes";
  return "Indexes";
};

const validateDatabaseSchema = (options: ValidateDatabaseSchemaOptions): number => {
  const { metaDir, verbose = false, exitOnComplete = false } = options;
  const issues: ValidationIssue[] = [];
  const allConstraints: Array<{ table: string; type: string; name: string; length: number }> = [];
  const finalize = (exitCode: number): number => {
    if (exitOnComplete) {
      process.exit(exitCode);
    }

    return exitCode;
  };

  const snapshot = getLatestSnapshot(metaDir);
  const tables = Object.values(snapshot.tables);
  const validateIndexWidth = (
    table: DrizzleTable,
    args: {
      name: string;
      columns: string[];
      keyType: IndexWidthIssue["keyType"];
    },
  ) => {
    const actualBytes = args.columns.reduce((total, columnName) => {
      const column = table.columns[columnName];

      if (!column) {
        return total;
      }

      return total + getTypeByteLength(column.type);
    }, 0);

    if (actualBytes > MYSQL_MAX_INDEX_BYTES || !Number.isFinite(actualBytes)) {
      issues.push({
        type: "index_width",
        tableName: table.name,
        name: args.name,
        keyType: args.keyType,
        actualBytes,
        maxBytes: MYSQL_MAX_INDEX_BYTES,
        columns: args.columns,
      });
    }
  };

  tables.forEach((table) => {
    // Check table name length
    if (table.name.length > MAX_IDENTIFIER_LENGTH) {
      issues.push({
        type: "table",
        tableName: table.name,
        name: table.name,
        actualLength: table.name.length,
        maxLength: MAX_IDENTIFIER_LENGTH,
      });
    }

    // Check column name lengths
    Object.values(table.columns).forEach((column) => {
      if (column.name.length > MAX_IDENTIFIER_LENGTH) {
        issues.push({
          type: "column",
          tableName: table.name,
          name: column.name,
          actualLength: column.name.length,
          maxLength: MAX_IDENTIFIER_LENGTH,
        });
      }
    });

    // Check foreign key constraint names
    Object.values(table.foreignKeys).forEach((fk) => {
      allConstraints.push({ table: table.name, type: "FK", name: fk.name, length: fk.name.length });
      if (fk.name.length > MAX_CONSTRAINT_NAME_LENGTH) {
        issues.push({
          type: "constraint",
          tableName: table.name,
          name: fk.name,
          actualLength: fk.name.length,
          maxLength: MAX_CONSTRAINT_NAME_LENGTH,
          constraintType: "foreign_key",
        });
      }
    });

    // Check primary key constraint names
    Object.values(table.compositePrimaryKeys).forEach((pk) => {
      const pkType = pk.columns.length > 1 ? "PK (composite)" : "PK";
      allConstraints.push({ table: table.name, type: pkType, name: pk.name, length: pk.name.length });
      if (pk.name.length > MAX_CONSTRAINT_NAME_LENGTH) {
        issues.push({
          type: "constraint",
          tableName: table.name,
          name: pk.name,
          actualLength: pk.name.length,
          maxLength: MAX_CONSTRAINT_NAME_LENGTH,
          constraintType: "primary_key",
        });
      }

      validateIndexWidth(table, {
        name: pk.name,
        columns: pk.columns,
        keyType: "primary_key",
      });
    });

    // Check unique constraint names
    Object.values(table.uniqueConstraints).forEach((unique) => {
      allConstraints.push({ table: table.name, type: "UNIQUE", name: unique.name, length: unique.name.length });
      if (unique.name.length > MAX_CONSTRAINT_NAME_LENGTH) {
        issues.push({
          type: "constraint",
          tableName: table.name,
          name: unique.name,
          actualLength: unique.name.length,
          maxLength: MAX_CONSTRAINT_NAME_LENGTH,
          constraintType: "unique",
        });
      }

      validateIndexWidth(table, {
        name: unique.name,
        columns: unique.columns,
        keyType: "unique",
      });
    });

    // Check index names
    Object.values(table.indexes).forEach((index) => {
      allConstraints.push({ table: table.name, type: "INDEX", name: index.name, length: index.name.length });
      if (index.name.length > MAX_CONSTRAINT_NAME_LENGTH) {
        issues.push({
          type: "constraint",
          tableName: table.name,
          name: index.name,
          actualLength: index.name.length,
          maxLength: MAX_CONSTRAINT_NAME_LENGTH,
          constraintType: "index",
        });
      }

      validateIndexWidth(table, {
        name: index.name,
        columns: index.columns,
        keyType: index.isUnique ? "unique" : "index",
      });
    });
  });

  // Verbose mode: show all constraints checked
  if (verbose) {
    consola.box("All Constraints Checked");
    const sortedConstraints = allConstraints.sort((a, b) => b.length - a.length);
    sortedConstraints.forEach((constraint) => {
      const exceeds = constraint.length > MAX_CONSTRAINT_NAME_LENGTH;
      const lengthStr = `[${constraint.length.toString().padStart(2)} chars]`;
      const typeStr = constraint.type.padEnd(15);
      const message = `${lengthStr} ${typeStr} ${constraint.name} (${constraint.table})`;
      if (exceeds) {
        consola.error(message);
      } else {
        consola.success(message);
      }
    });
    consola.log("");
  }

  // Print report
  consola.box("MySQL Schema Analysis");
  consola.info(`Maximum identifier length: ${MAX_IDENTIFIER_LENGTH} characters`);
  consola.info(`Maximum constraint name length: ${MAX_CONSTRAINT_NAME_LENGTH} characters`);
  consola.info(`Maximum index key length: ${MYSQL_MAX_INDEX_BYTES} bytes`);
  consola.info(`Analyzed ${tables.length} tables`);
  consola.log("");

  // Show table summary
  consola.start("Tables analyzed:");
  tables.forEach((table) => {
    const columnCount = Object.keys(table.columns).length;
    const fkCount = Object.keys(table.foreignKeys).length;
    const pkCount = Object.keys(table.compositePrimaryKeys).length;
    const uniqueCount = Object.keys(table.uniqueConstraints).length;
    const indexCount = Object.keys(table.indexes).length;

    const parts: string[] = [];
    parts.push(`${columnCount} columns`);
    if (fkCount > 0) {
      parts.push(`${fkCount} FKs`);
    }
    if (pkCount > 0) {
      parts.push(`${pkCount} PKs`);
    }
    if (uniqueCount > 0) {
      parts.push(`${uniqueCount} unique`);
    }
    if (indexCount > 0) {
      parts.push(`${indexCount} indexes`);
    }

    consola.log(`  - ${table.name} (${parts.join(", ")})`);
  });
  consola.log("");

  if (issues.length === 0) {
    consola.success("No schema validation issues found!");
    return finalize(0);
  }

  consola.warn(`Found ${issues.length} schema validation issue(s):`);
  consola.log("");

  const tableIssues = issues.filter((i): i is NameLengthIssue => i.type === "table");
  const columnIssues = issues.filter((i): i is NameLengthIssue => i.type === "column");
  const constraintIssues = issues.filter((i): i is NameLengthIssue => i.type === "constraint");
  const indexWidthIssues = issues.filter((i): i is IndexWidthIssue => i.type === "index_width");

  if (tableIssues.length > 0) {
    consola.error("Table Name Issues:");
    tableIssues.forEach((issue) => {
      consola.log(
        `  - Table: ${issue.name} (${issue.actualLength} chars, exceeds max by ${issue.actualLength - issue.maxLength})`,
      );
    });
    consola.log("");
  }

  if (columnIssues.length > 0) {
    consola.error("Column Name Issues:");
    columnIssues.forEach((issue) => {
      consola.log(
        `  - ${issue.tableName}.${issue.name} (${issue.actualLength} chars, exceeds max by ${issue.actualLength - issue.maxLength})`,
      );
    });
    consola.log("");
  }

  if (constraintIssues.length > 0) {
    consola.error("Constraint Name Issues:");
    const fkIssues = constraintIssues.filter((i) => i.constraintType === "foreign_key");
    const pkIssues = constraintIssues.filter((i) => i.constraintType === "primary_key");
    const uniqueIssues = constraintIssues.filter((i) => i.constraintType === "unique");
    const indexIssues = constraintIssues.filter((i) => i.constraintType === "index");

    if (fkIssues.length > 0) {
      consola.log("  Foreign Keys:");
      fkIssues.forEach((issue) => {
        consola.log(
          `    - ${issue.name} (${issue.actualLength} chars, exceeds max by ${issue.actualLength - issue.maxLength})`,
        );
        consola.log(`      Table: ${issue.tableName}`);
      });
    }

    if (pkIssues.length > 0) {
      consola.log("  Primary Keys:");
      pkIssues.forEach((issue) => {
        consola.log(
          `    - ${issue.name} (${issue.actualLength} chars, exceeds max by ${issue.actualLength - issue.maxLength})`,
        );
        consola.log(`      Table: ${issue.tableName}`);
      });
    }

    if (uniqueIssues.length > 0) {
      consola.log("  Unique Constraints:");
      uniqueIssues.forEach((issue) => {
        consola.log(
          `    - ${issue.name} (${issue.actualLength} chars, exceeds max by ${issue.actualLength - issue.maxLength})`,
        );
        consola.log(`      Table: ${issue.tableName}`);
      });
    }

    if (indexIssues.length > 0) {
      consola.log("  Indexes:");
      indexIssues.forEach((issue) => {
        consola.log(
          `    - ${issue.name} (${issue.actualLength} chars, exceeds max by ${issue.actualLength - issue.maxLength})`,
        );
        consola.log(`      Table: ${issue.tableName}`);
      });
    }
    consola.log("");
  }

  if (indexWidthIssues.length > 0) {
    consola.error("Index Width Issues:");
    const primaryKeyWidthIssues = indexWidthIssues.filter((issue) => issue.keyType === "primary_key");
    const uniqueWidthIssues = indexWidthIssues.filter((issue) => issue.keyType === "unique");
    const indexOnlyWidthIssues = indexWidthIssues.filter((issue) => issue.keyType === "index");

    for (const issueGroup of [primaryKeyWidthIssues, uniqueWidthIssues, indexOnlyWidthIssues]) {
      if (issueGroup.length === 0) {
        continue;
      }

      consola.log(`  ${getKeyTypeLabel(issueGroup[0]!.keyType)}:`);
      issueGroup.forEach((issue) => {
        const actualBytes = Number.isFinite(issue.actualBytes) ? issue.actualBytes.toString() : "unbounded";
        consola.log(
          `    - ${issue.name} (${actualBytes} bytes, exceeds max by ${
            Number.isFinite(issue.actualBytes) ? issue.actualBytes - issue.maxBytes : "unknown amount"
          })`,
        );
        consola.log(`      Table: ${issue.tableName}`);
        consola.log(`      Columns: ${issue.columns.join(", ")}`);
      });
    }

    consola.log("");
  }

  consola.box("Summary");
  consola.info(`Total issues: ${issues.length}`);
  consola.info(`  - Table names: ${tableIssues.length}`);
  consola.info(`  - Column names: ${columnIssues.length}`);
  consola.info(`  - Constraint names: ${constraintIssues.length}`);
  consola.info(`  - Index widths: ${indexWidthIssues.length}`);
  if (constraintIssues.length > 0) {
    const fkCount = constraintIssues.filter((i) => i.constraintType === "foreign_key").length;
    const pkCount = constraintIssues.filter((i) => i.constraintType === "primary_key").length;
    const uniqueCount = constraintIssues.filter((i) => i.constraintType === "unique").length;
    const indexCount = constraintIssues.filter((i) => i.constraintType === "index").length;
    consola.info(`    - Foreign keys: ${fkCount}`);
    consola.info(`    - Primary keys: ${pkCount}`);
    consola.info(`    - Unique constraints: ${uniqueCount}`);
    consola.info(`    - Indexes: ${indexCount}`);
  }
  if (indexWidthIssues.length > 0) {
    const pkWidthCount = indexWidthIssues.filter((i) => i.keyType === "primary_key").length;
    const uniqueWidthCount = indexWidthIssues.filter((i) => i.keyType === "unique").length;
    const indexWidthCount = indexWidthIssues.filter((i) => i.keyType === "index").length;
    consola.info(`    - Primary keys: ${pkWidthCount}`);
    consola.info(`    - Unique indexes: ${uniqueWidthCount}`);
    consola.info(`    - Indexes: ${indexWidthCount}`);
  }
  consola.log("");

  // Print actionable feedback
  consola.fail("MIGRATION BLOCKED: Schema validation violations detected!");
  consola.log("");
  consola.start("Action required:");
  consola.log("1. Review the issues listed above");
  consola.log("2. Shorten table/column/constraint names where required");
  consola.log("3. Reduce indexed column widths or introduce prefix/hash columns for oversized indexes");
  consola.log("4. Run 'pnpm generate' again after making changes");
  consola.log("5. Run this check with --verbose to see all constraint names");
  consola.log("");

  return finalize(1);
};

export { validateDatabaseSchema };
