import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import { migrateDatabase } from "../../../local-store/storage/sqlite/migrations";

import { createLocalStoreRepository } from "./repository";

test("LocalStore repository owns lifecycle reads and writes without exposing its SQLite driver", () => {
  const database = new Database(":memory:");
  migrateDatabase(database);
  const repository = createLocalStoreRepository(database);
  try {
    repository.writeDerivedState({
      generation: 0,
      effectiveRevision: 0,
      activePacks: [],
      effectivePractices: [],
    });

    expect(repository.readStoreMetadata()).toEqual({
      schemaVersion: 1,
      generation: 0,
      effectiveRevision: 0,
    });
    expect(repository.readLocalStoreSnapshot()?.activePacks).toEqual([]);
  } finally {
    repository.close();
  }
});
