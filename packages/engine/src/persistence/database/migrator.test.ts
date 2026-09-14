import { expect, test } from "bun:test";

import {
  keywordIndexDatabaseDefinition,
  localStoreDatabaseDefinition,
  semanticIndexDatabaseDefinition,
} from "../definitions";

import { openSqliteConnection } from "./connection";
import { migrateSqlite } from "./migrator";

test("Drizzle LocalStore init is versioned and idempotent", () => {
  const connection = openSqliteConnection(":memory:", localStoreDatabaseDefinition.schema);
  try {
    migrateSqlite(connection, localStoreDatabaseDefinition);
    migrateSqlite(connection, localStoreDatabaseDefinition);

    const tables = connection.client
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('__drizzle_migrations', 'local_store_metadata', 'active_packs', 'practice_sources', 'effective_practices', 'effective_revision_outbox', 'effective_revision_log') ORDER BY name",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      "__drizzle_migrations",
      "active_packs",
      "effective_practices",
      "effective_revision_log",
      "effective_revision_outbox",
      "local_store_metadata",
      "practice_sources",
    ]);
    expect(
      connection.client.query("SELECT COUNT(*) AS count FROM __drizzle_migrations").get(),
    ).toEqual({
      count: 1,
    });
  } finally {
    connection.close();
  }
});

test("Drizzle keyword init includes the owned FTS5 virtual table", () => {
  const connection = openSqliteConnection(":memory:", keywordIndexDatabaseDefinition.schema);
  try {
    migrateSqlite(connection, keywordIndexDatabaseDefinition);

    expect(
      connection.client
        .query("SELECT sql FROM sqlite_master WHERE name = 'keyword_documents'")
        .get(),
    ).toEqual({
      sql: "CREATE VIRTUAL TABLE keyword_documents USING fts5(\n  practice_id UNINDEXED,\n  content_digest UNINDEXED,\n  id,\n  title,\n  applies_when,\n  tech_stack,\n  stage,\n  anti_patterns,\n  body,\n  tokenize = 'unicode61 remove_diacritics 0'\n)",
    });
  } finally {
    connection.close();
  }
});

test("Drizzle semantic init creates the metadata and vector tables", () => {
  const connection = openSqliteConnection(":memory:", semanticIndexDatabaseDefinition.schema);
  try {
    migrateSqlite(connection, semanticIndexDatabaseDefinition);

    expect(
      connection.client
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('semantic_index_metadata', 'semantic_vectors') ORDER BY name",
        )
        .all(),
    ).toEqual([{ name: "semantic_index_metadata" }, { name: "semantic_vectors" }]);
  } finally {
    connection.close();
  }
});
