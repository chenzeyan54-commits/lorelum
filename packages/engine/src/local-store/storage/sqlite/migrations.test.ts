import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import { LOCAL_STORE_SCHEMA_VERSION, migrateDatabase } from "./migrations";

test("Drizzle init creates the LocalStore schema and records one applied baseline", () => {
  const database = new Database(":memory:");
  try {
    migrateDatabase(database);
    migrateDatabase(database);

    expect(database.query("SELECT COUNT(*) AS count FROM __drizzle_migrations").get()).toEqual({
      count: 1,
    });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('local_store_metadata', 'active_packs', 'practice_sources', 'effective_practices', 'effective_revision_outbox', 'effective_revision_log') ORDER BY name",
        )
        .all()
        .map((row) => (row as { name: string }).name),
    ).toEqual([
      "active_packs",
      "effective_practices",
      "effective_revision_log",
      "effective_revision_outbox",
      "local_store_metadata",
      "practice_sources",
    ]);
    database
      .query(
        "INSERT INTO local_store_metadata (singleton, schema_version, installed_packs_generation, effective_revision) VALUES (1, ?, 0, 0)",
      )
      .run(LOCAL_STORE_SCHEMA_VERSION);
    expect(database.query("SELECT schema_version FROM local_store_metadata").get()).toEqual({
      schema_version: LOCAL_STORE_SCHEMA_VERSION,
    });
  } finally {
    database.close();
  }
});

test("Drizzle init refuses an unknown newer migration history", () => {
  const database = new Database(":memory:");
  try {
    migrateDatabase(database);
    database
      .query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
      .run("future-migration", Date.now());

    expect(() => migrateDatabase(database)).toThrow("migration history is unsupported");
  } finally {
    database.close();
  }
});
