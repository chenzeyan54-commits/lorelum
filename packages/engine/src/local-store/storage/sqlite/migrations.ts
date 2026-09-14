import type { Database } from "bun:sqlite";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { createSqliteConnection } from "../../../persistence/database/connection";
import { migrateSqlite } from "../../../persistence/database/migrator";
import { localStoreDatabaseDefinition } from "../../../persistence/definitions";

import { SqliteStateError } from "../errors";

/** The first Drizzle baseline; legacy SQLite files are rebuilt, never upgraded in place. */
export const LOCAL_STORE_SCHEMA_VERSION = 1;

function assertNoUnknownAppliedMigration(database: Database): void {
  const table = database
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  if (table === null || table === undefined) return;

  const expectedHashes = new Set(
    readMigrationFiles({ migrationsFolder: localStoreDatabaseDefinition.migrationsFolder }).map(
      (migration) => migration.hash,
    ),
  );
  const rows = database.query("SELECT hash FROM __drizzle_migrations").all() as unknown[];
  for (const row of rows) {
    if (
      typeof row !== "object" ||
      row === null ||
      !("hash" in row) ||
      typeof row.hash !== "string" ||
      !expectedHashes.has(row.hash)
    ) {
      throw new SqliteStateError("SQLite migration history is unsupported");
    }
  }
}

/** Apply checked-in Drizzle migrations to a new/current LocalStore SQLite file. */
export function migrateDatabase(database: Database): void {
  try {
    database.exec("PRAGMA foreign_keys = ON");
    assertNoUnknownAppliedMigration(database);
    migrateSqlite(
      createSqliteConnection(database, localStoreDatabaseDefinition.schema),
      localStoreDatabaseDefinition,
    );
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("SQLite migration failed", error);
  }
}
