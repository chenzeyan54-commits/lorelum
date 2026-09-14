import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import { migrateDatabase } from "./migrations";
import {
  deletePendingRevisionNotification,
  readPendingRevisionNotifications,
} from "./revision-outbox";
import { writeDerivedState } from "./state-writer";
import { testLocalStoreDatabase } from "./test-utils";

const emptyDelta = Object.freeze({
  added: Object.freeze([] as string[]),
  changed: Object.freeze([] as string[]),
  invalidated: Object.freeze([] as string[]),
});

test("revision outbox persists ordered notifications across derived-state rewrites", () => {
  const database = new Database(":memory:");
  try {
    migrateDatabase(database);
    const orm = testLocalStoreDatabase(database);
    for (const revision of [1, 2]) {
      writeDerivedState(orm, {
        generation: revision,
        effectiveRevision: revision,
        activePacks: [],
        effectivePractices: [],
        revisionNotification: { delta: emptyDelta },
      });
    }
    expect(readPendingRevisionNotifications(orm).map((row) => row.revision)).toEqual([1, 2]);

    deletePendingRevisionNotification(orm, 1);
    expect(readPendingRevisionNotifications(orm).map((row) => row.revision)).toEqual([2]);
  } finally {
    database.close();
  }
});

test("a reindex full refresh supersedes older pending deltas", () => {
  const database = new Database(":memory:");
  try {
    migrateDatabase(database);
    const orm = testLocalStoreDatabase(database);
    writeDerivedState(orm, {
      generation: 1,
      effectiveRevision: 1,
      activePacks: [],
      effectivePractices: [],
      revisionNotification: { delta: emptyDelta },
    });
    writeDerivedState(orm, {
      generation: 2,
      effectiveRevision: 2,
      activePacks: [],
      effectivePractices: [],
      revisionNotification: { delta: emptyDelta, supersedesPending: true },
    });
    expect(readPendingRevisionNotifications(orm).map((row) => row.revision)).toEqual([2]);
  } finally {
    database.close();
  }
});
