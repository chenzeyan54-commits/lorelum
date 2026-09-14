import type { Database } from "bun:sqlite";

import { createSqliteConnection } from "../../database/connection";
import { localStoreDatabaseDefinition } from "../../definitions";
import type { EffectivePractice } from "../../../local-store/model";
import type { InstalledPackManifestEntry } from "../../../local-store/storage/manifest/manifest-store";
import { readPractice } from "../../../local-store/storage/sqlite/practice-reader";
import {
  readEffectiveRevisionLog,
  type EffectiveRevisionLogEntry,
} from "../../../local-store/storage/sqlite/revision-log";
import {
  deletePendingRevisionNotification,
  readPendingRevisionNotifications,
  type PendingRevisionNotification,
} from "../../../local-store/storage/sqlite/revision-outbox";
import {
  materializeEffectivePractices,
  materializeEffectivePracticesByIds,
  readActivePackEntries,
  readLocalStoreSnapshot,
  readPracticeIdsForPack,
  readStoreMetadata,
  type LocalStoreSnapshot,
  type StoreMetadataSnapshot,
} from "../../../local-store/storage/sqlite/snapshot-reader";
import {
  applyIncrementalDerivedState,
  writeDerivedState,
  type DerivedStoreState,
  type IncrementalDerivedStoreState,
} from "../../../local-store/storage/sqlite/state-writer";
import type { MutationMetricsObserver } from "../../../local-store/storage/sqlite/mutation-metrics";

/**
 * LocalStore's only persistence-facing contract for lifecycle use cases.
 * The repository owns the SQLite connection; lifecycle code sees neither a
 * driver handle nor raw SQL.
 */
export interface LocalStoreRepository {
  close(): void;
  transaction<T>(run: () => T): T;
  readStoreMetadata(): StoreMetadataSnapshot | undefined;
  readLocalStoreSnapshot(): LocalStoreSnapshot | undefined;
  readActivePackEntries(): readonly InstalledPackManifestEntry[];
  readPracticeIdsForPack(packName: string): readonly string[];
  materializeEffectivePractices(metadata: StoreMetadataSnapshot): readonly EffectivePractice[];
  materializeEffectivePracticesByIds(
    metadata: StoreMetadataSnapshot,
    ids: readonly string[],
  ): readonly EffectivePractice[];
  readPractice(metadata: StoreMetadataSnapshot, practiceId: string): EffectivePractice | undefined;
  readEffectiveRevisionLog(afterRevision: number): readonly EffectiveRevisionLogEntry[];
  readPendingRevisionNotifications(): readonly PendingRevisionNotification[];
  deletePendingRevisionNotification(revision: number): void;
  writeDerivedState(state: DerivedStoreState): void;
  applyIncrementalDerivedState(
    state: IncrementalDerivedStoreState,
    metrics?: MutationMetricsObserver,
  ): void;
}

/** Wrap an already-open, migrated LocalStore driver for lifecycle use. */
export function createLocalStoreRepository(database: Database): LocalStoreRepository {
  const connection = createSqliteConnection(database, localStoreDatabaseDefinition.schema);
  return Object.freeze({
    close() {
      connection.close();
    },
    transaction<T>(run: () => T): T {
      return connection.orm.transaction(run);
    },
    readStoreMetadata() {
      return readStoreMetadata(connection.orm);
    },
    readLocalStoreSnapshot() {
      return readLocalStoreSnapshot(connection.orm);
    },
    readActivePackEntries() {
      return readActivePackEntries(connection.orm);
    },
    readPracticeIdsForPack(packName) {
      return readPracticeIdsForPack(connection.orm, packName);
    },
    materializeEffectivePractices(metadata) {
      return materializeEffectivePractices(connection.orm, metadata);
    },
    materializeEffectivePracticesByIds(metadata, ids) {
      return materializeEffectivePracticesByIds(connection.orm, metadata, ids);
    },
    readPractice(metadata, practiceId) {
      return readPractice(connection.orm, metadata, practiceId);
    },
    readEffectiveRevisionLog(afterRevision) {
      return readEffectiveRevisionLog(connection.orm, afterRevision);
    },
    readPendingRevisionNotifications() {
      return readPendingRevisionNotifications(connection.orm);
    },
    deletePendingRevisionNotification(revision) {
      deletePendingRevisionNotification(connection.orm, revision);
    },
    writeDerivedState(state) {
      writeDerivedState(connection.orm, state);
    },
    applyIncrementalDerivedState(state, metrics) {
      applyIncrementalDerivedState(connection.orm, state, metrics);
    },
  } satisfies LocalStoreRepository);
}
