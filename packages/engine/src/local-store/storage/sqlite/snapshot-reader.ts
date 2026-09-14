import { asc, eq, inArray } from "drizzle-orm";

import type { EffectivePractice } from "../../model";
import {
  activePacks,
  effectivePractices,
  localStoreMetadata,
  practiceSources,
} from "../../../persistence/schemas/local-store";
import type { LocalStoreDatabase } from "../../../persistence/schemas/database-types";
import { materializePracticeRows } from "./row-materializer";

import { SqliteStateError } from "../errors";
import type { InstalledPackManifestEntry } from "../manifest/manifest-store";

import { LOCAL_STORE_SCHEMA_VERSION } from "./migrations";

export interface StoreMetadataSnapshot {
  schemaVersion: number;
  generation: number;
  effectiveRevision: number;
}

export interface EffectivePracticeSnapshot {
  metadata: StoreMetadataSnapshot;
  effectivePractices: readonly EffectivePractice[];
}

/** One SQLite read transaction used by cold-open consistency verification. */
export interface LocalStoreSnapshot extends EffectivePracticeSnapshot {
  activePacks: readonly InstalledPackManifestEntry[];
}

/**
 * Read the store metadata row, or `undefined` when the database has never
 * been written (a freshly migrated store). Callers that must distinguish
 * "empty store" from "corrupt store" use this instead of the throwing
 * materializer.
 */
export function readStoreMetadata(database: LocalStoreDatabase): StoreMetadataSnapshot | undefined {
  try {
    const row = database
      .select({
        schemaVersion: localStoreMetadata.schemaVersion,
        generation: localStoreMetadata.installedPacksGeneration,
        effectiveRevision: localStoreMetadata.effectiveRevision,
      })
      .from(localStoreMetadata)
      .where(eq(localStoreMetadata.singleton, 1))
      .get();
    if (row === undefined) return undefined;
    if (
      row.schemaVersion !== LOCAL_STORE_SCHEMA_VERSION ||
      typeof row.generation !== "number" ||
      typeof row.effectiveRevision !== "number"
    ) {
      throw new SqliteStateError("LocalStore metadata row is missing or malformed");
    }
    return Object.freeze({
      schemaVersion: row.schemaVersion,
      generation: row.generation,
      effectiveRevision: row.effectiveRevision,
    });
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot read LocalStore metadata", error);
  }
}

export function materializeEffectivePractices(
  database: LocalStoreDatabase,
  metadata: StoreMetadataSnapshot,
): readonly EffectivePractice[] {
  const rows = database
    .select({
      practice_id: effectivePractices.practiceId,
      content_digest: effectivePractices.contentDigest,
      canonical_content: effectivePractices.canonicalContent,
      title: effectivePractices.title,
      stage: effectivePractices.stage,
      tech_stack_json: effectivePractices.techStackJson,
      applies_when: effectivePractices.appliesWhen,
      severity: effectivePractices.severity,
      effective_revision: effectivePractices.effectiveRevision,
      pack_name: practiceSources.packName,
      source_path: practiceSources.sourcePath,
      source_digest: practiceSources.contentDigest,
    })
    .from(effectivePractices)
    .leftJoin(practiceSources, eq(practiceSources.practiceId, effectivePractices.practiceId))
    .orderBy(
      asc(effectivePractices.practiceId),
      asc(practiceSources.packName),
      asc(practiceSources.sourcePath),
    )
    .all();

  return materializePracticeRows(rows, metadata);
}

/** Materializes a bounded subset while retaining the same row validation as full reads. */
export function materializeEffectivePracticesByIds(
  database: LocalStoreDatabase,
  metadata: StoreMetadataSnapshot,
  ids: readonly string[],
): readonly EffectivePractice[] {
  if (ids.length === 0) return Object.freeze([]);
  const uniqueIds = [...new Set(ids)].sort();
  try {
    const rows = database
      .select({
        practice_id: effectivePractices.practiceId,
        content_digest: effectivePractices.contentDigest,
        canonical_content: effectivePractices.canonicalContent,
        title: effectivePractices.title,
        stage: effectivePractices.stage,
        tech_stack_json: effectivePractices.techStackJson,
        applies_when: effectivePractices.appliesWhen,
        severity: effectivePractices.severity,
        effective_revision: effectivePractices.effectiveRevision,
        pack_name: practiceSources.packName,
        source_path: practiceSources.sourcePath,
        source_digest: practiceSources.contentDigest,
      })
      .from(effectivePractices)
      .leftJoin(practiceSources, eq(practiceSources.practiceId, effectivePractices.practiceId))
      .where(inArray(effectivePractices.practiceId, uniqueIds))
      .orderBy(
        asc(effectivePractices.practiceId),
        asc(practiceSources.packName),
        asc(practiceSources.sourcePath),
      )
      .all();
    return materializePracticeRows(rows, metadata);
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot materialize selected Effective Practices", error);
  }
}

/** Materializes Effective Practices and sources from one deterministically ordered SQL statement. */
export function readEffectivePracticeSnapshot(
  database: LocalStoreDatabase,
): EffectivePracticeSnapshot {
  try {
    return database.transaction(() => {
      const metadata = readStoreMetadata(database);
      if (metadata === undefined) {
        throw new SqliteStateError("LocalStore metadata row is missing");
      }
      return Object.freeze({
        metadata,
        effectivePractices: materializeEffectivePractices(database, metadata),
      });
    });
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot materialize Effective Practices", error);
  }
}

/** Read the Active Pack rows deterministically ordered by pack name. */
export function readActivePackEntries(
  database: LocalStoreDatabase,
): readonly InstalledPackManifestEntry[] {
  try {
    const rows = database
      .select({
        packName: activePacks.packName,
        packVersion: activePacks.packVersion,
        artifactDigest: activePacks.artifactDigest,
        storageKey: activePacks.storageKey,
        installedAt: activePacks.installedAt,
      })
      .from(activePacks)
      .orderBy(asc(activePacks.packName))
      .all();
    return Object.freeze(
      rows.map((row) => {
        if (
          typeof row.packName !== "string" ||
          typeof row.packVersion !== "string" ||
          typeof row.artifactDigest !== "string" ||
          typeof row.storageKey !== "string" ||
          typeof row.installedAt !== "string"
        ) {
          throw new SqliteStateError("active Pack row is malformed");
        }
        return Object.freeze({
          packName: row.packName,
          packVersion: row.packVersion,
          artifactDigest: row.artifactDigest,
          storageKey: row.storageKey,
          installedAt: row.installedAt,
        });
      }),
    );
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot materialize Active Pack rows", error);
  }
}

/** Read the bounded Practice-ID set owned by one active Pack. */
export function readPracticeIdsForPack(
  database: LocalStoreDatabase,
  packName: string,
): readonly string[] {
  try {
    const rows = database
      .select({ practiceId: practiceSources.practiceId })
      .from(practiceSources)
      .where(eq(practiceSources.packName, packName))
      .orderBy(asc(practiceSources.practiceId))
      .all();
    const ids = rows.map((row) => row.practiceId);
    if (ids.some((id) => typeof id !== "string")) {
      throw new SqliteStateError("Practice source ID is malformed");
    }
    return Object.freeze(ids as string[]);
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot read Pack Practice IDs", error);
  }
}

/**
 * Read metadata, Active Packs, Effective Practices, and source rows from one
 * SQLite snapshot. Cold open pairs this with manifest A/B reads so it never
 * compares different committed generations.
 */
export function readLocalStoreSnapshot(
  database: LocalStoreDatabase,
): LocalStoreSnapshot | undefined {
  try {
    return database.transaction(() => {
      const metadata = readStoreMetadata(database);
      if (metadata === undefined) return undefined;
      return Object.freeze({
        metadata,
        activePacks: readActivePackEntries(database),
        effectivePractices: materializeEffectivePractices(database, metadata),
      });
    });
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot read a consistent LocalStore snapshot", error);
  }
}
