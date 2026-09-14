import { randomUUID } from "node:crypto";
import { access, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { KeywordIndexError } from "../errors";
import { acquireMutationLock } from "../../local-store/storage/mutation-lock";
import { openSqliteConnection, type SqliteConnection } from "../../persistence/database/connection";
import { migrateSqlite } from "../../persistence/database/migrator";
import { keywordIndexDatabaseDefinition } from "../../persistence/definitions";
import { keywordIndexMetadata } from "../../persistence/schemas/keyword-index";
import {
  KEYWORD_INDEX_VERSION,
  deleteKeywordDocuments,
  insertKeywordDocuments,
  openKeywordIndex,
  toKeywordIndexError,
  type KeywordIndex,
} from "./keyword-index";
import type { KeywordDocument } from "./projection";

export interface KeywordIndexCheckpoint {
  readonly rootBinding: string;
  readonly effectiveRevision: number;
}

export interface PersistentKeywordIndex extends KeywordIndex {
  readonly checkpoint: KeywordIndexCheckpoint;
  applyChanges(
    nextCheckpoint: KeywordIndexCheckpoint,
    removedPracticeIds: readonly string[],
    documents: readonly KeywordDocument[],
  ): void;
}

const INDEX_FILE_NAME = "active.sqlite";
const INDEX_WRITER_DIRECTORY = "writer";

type KeywordIndexConnection = SqliteConnection<typeof keywordIndexDatabaseDefinition.schema>;

function paths(rootPath: string): { readonly directory: string; readonly active: string } {
  const directory = join(rootPath, "indexes", "keyword", `v${KEYWORD_INDEX_VERSION}`);
  return Object.freeze({ directory, active: join(directory, INDEX_FILE_NAME) });
}

/** Serialize index publication and delta writes without blocking Store mutations. */
export async function withPersistentKeywordIndexWriter<T>(
  rootPath: string,
  work: () => Promise<T>,
): Promise<T> {
  const { directory } = paths(rootPath);
  const writerRoot = join(directory, INDEX_WRITER_DIRECTORY);
  await mkdir(writerRoot, { recursive: true });
  const lock = await acquireMutationLock(writerRoot);
  try {
    return await work();
  } finally {
    await lock.release();
  }
}

interface KeywordIndexMetadataRow extends Record<string, unknown> {
  readonly rootBinding: string;
  readonly effectiveRevision: number;
}

function isValidCheckpoint(value: unknown): value is KeywordIndexMetadataRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.rootBinding === "string" &&
    typeof row.effectiveRevision === "number" &&
    Number.isSafeInteger(row.effectiveRevision) &&
    row.effectiveRevision >= 0
  );
}

function readCheckpoint(connection: KeywordIndexConnection): KeywordIndexCheckpoint {
  const row = connection.orm
    .select({
      rootBinding: keywordIndexMetadata.rootBinding,
      effectiveRevision: keywordIndexMetadata.effectiveRevision,
    })
    .from(keywordIndexMetadata)
    .where(eq(keywordIndexMetadata.singleton, 1))
    .get();
  if (!isValidCheckpoint(row)) throw new KeywordIndexError("Keyword index metadata is invalid");
  return Object.freeze({
    rootBinding: row.rootBinding,
    effectiveRevision: row.effectiveRevision,
  });
}

function writeCheckpoint(
  connection: KeywordIndexConnection,
  checkpoint: KeywordIndexCheckpoint,
): void {
  connection.orm
    .update(keywordIndexMetadata)
    .set({
      rootBinding: checkpoint.rootBinding,
      effectiveRevision: checkpoint.effectiveRevision,
    })
    .where(eq(keywordIndexMetadata.singleton, 1))
    .run();
  if (!checkpointEquals(readCheckpoint(connection), checkpoint)) {
    throw new KeywordIndexError("Keyword index metadata is invalid");
  }
}

function writeInitialCheckpoint(
  connection: KeywordIndexConnection,
  checkpoint: KeywordIndexCheckpoint,
): void {
  connection.orm
    .insert(keywordIndexMetadata)
    .values({
      singleton: 1,
      rootBinding: checkpoint.rootBinding,
      effectiveRevision: checkpoint.effectiveRevision,
    })
    .run();
}

function checkpointEquals(left: KeywordIndexCheckpoint, right: KeywordIndexCheckpoint): boolean {
  return (
    left.rootBinding === right.rootBinding && left.effectiveRevision === right.effectiveRevision
  );
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}

function wrap(
  connection: KeywordIndexConnection,
  initial: KeywordIndexCheckpoint,
): PersistentKeywordIndex {
  let checkpoint = initial;
  const keywordIndex = openKeywordIndex(connection.client);
  return Object.freeze({
    get checkpoint() {
      return checkpoint;
    },
    search(text, limit) {
      return keywordIndex.search(text, limit);
    },
    applyChanges(nextCheckpoint, removedPracticeIds, documents) {
      if (nextCheckpoint.rootBinding !== checkpoint.rootBinding) {
        throw new KeywordIndexError("Keyword index root binding changed");
      }
      if (nextCheckpoint.effectiveRevision < checkpoint.effectiveRevision) {
        throw new KeywordIndexError("Keyword index revision moved backwards");
      }
      try {
        connection.orm.transaction(() => {
          // FTS5 document mutation remains native SQL because virtual-table
          // MATCH/bm25 semantics are outside Drizzle's table abstraction.
          deleteKeywordDocuments(connection.client, uniqueIds(removedPracticeIds));
          insertKeywordDocuments(connection.client, documents);
          writeCheckpoint(connection, nextCheckpoint);
        });
        checkpoint = nextCheckpoint;
      } catch (error) {
        if (error instanceof KeywordIndexError) throw error;
        throw new KeywordIndexError("Cannot update SQLite keyword index", { cause: error });
      }
    },
    close() {
      keywordIndex.close();
    },
  } satisfies PersistentKeywordIndex);
}

/** Open an existing persistent index. Missing means it has not been built yet. */
export async function openPersistentKeywordIndex(
  rootPath: string,
): Promise<PersistentKeywordIndex | undefined> {
  const { active } = paths(rootPath);
  try {
    await access(active);
  } catch {
    return undefined;
  }
  let connection: KeywordIndexConnection | undefined;
  try {
    connection = openSqliteConnection(active, keywordIndexDatabaseDefinition.schema);
    migrateSqlite(connection, keywordIndexDatabaseDefinition);
    connection.client.exec("PRAGMA journal_mode = WAL");
    return wrap(connection, readCheckpoint(connection));
  } catch (error) {
    try {
      connection?.close();
    } catch {
      // Keep the original corruption/open error.
    }
    throw toKeywordIndexError("Cannot open persistent SQLite keyword index", error);
  }
}

/** Build a complete index in a temporary file, then publish it atomically. */
export async function createPersistentKeywordIndex(
  rootPath: string,
  checkpoint: KeywordIndexCheckpoint,
  documents: readonly KeywordDocument[],
): Promise<PersistentKeywordIndex> {
  const { directory, active } = paths(rootPath);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `build-${randomUUID()}.sqlite`);
  let connection: KeywordIndexConnection | undefined;
  try {
    const stagingConnection = openSqliteConnection(
      temporary,
      keywordIndexDatabaseDefinition.schema,
    );
    connection = stagingConnection;
    migrateSqlite(stagingConnection, keywordIndexDatabaseDefinition);
    stagingConnection.orm.transaction(() => {
      insertKeywordDocuments(stagingConnection.client, documents);
      writeInitialCheckpoint(stagingConnection, checkpoint);
    });
    stagingConnection.close();
    connection = undefined;
    await rename(temporary, active);
    const opened = await openPersistentKeywordIndex(rootPath);
    if (opened === undefined || !checkpointEquals(opened.checkpoint, checkpoint)) {
      opened?.close();
      throw new KeywordIndexError("Published keyword index did not retain its checkpoint");
    }
    return opened;
  } catch (error) {
    try {
      connection?.close();
    } catch {
      // Preserve the useful failure below.
    }
    await rm(temporary, { force: true }).catch(() => undefined);
    throw toKeywordIndexError("Cannot build persistent SQLite keyword index", error);
  }
}
