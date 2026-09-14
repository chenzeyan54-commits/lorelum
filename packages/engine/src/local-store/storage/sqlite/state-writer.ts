import { eq, inArray } from "drizzle-orm";

import {
  canonicalizePractice,
  isPracticeSourcePath,
  type EffectivePractice,
  type RevisionDelta,
} from "../../model";
import type { InstalledPackManifestEntry } from "../manifest/manifest-store";
import {
  activePacks,
  effectivePractices,
  effectiveRevisionLog,
  effectiveRevisionOutbox,
  localStoreMetadata,
  practiceSources,
} from "../../../persistence/schemas/local-store";
import type { LocalStoreDatabase } from "../../../persistence/schemas/database-types";
import { SqliteStateError } from "../errors";
import type { MutationMetricsObserver } from "./mutation-metrics";
import { LOCAL_STORE_SCHEMA_VERSION } from "./migrations";
import { serializeRevisionDelta } from "./revision-delta";
import { appendEffectiveRevisionLog } from "./revision-log";

export interface DerivedStoreState {
  generation: number;
  effectiveRevision: number;
  activePacks: readonly InstalledPackManifestEntry[];
  effectivePractices: readonly EffectivePractice[];
  /** Persisted atomically with the revision so later deliveries cannot overtake it. */
  revisionNotification?:
    | {
        delta: RevisionDelta;
        /** A reindex notification is a full refresh and supersedes older pending deltas. */
        supersedesPending?: boolean;
      }
    | undefined;
  /** Persisted indexing history; independent of the consumable hook outbox. */
  revisionLogDelta?: RevisionDelta | undefined;
  /** Recovery rebuild invalidates every prior derived-index checkpoint. */
  clearRevisionLog?: boolean | undefined;
}

export interface IncrementalDerivedStoreState extends DerivedStoreState {
  /** The only active-Pack row changed by a normal lifecycle mutation. */
  activePackMutation:
    | { readonly kind: "upsert"; readonly entry: InstalledPackManifestEntry }
    | { readonly kind: "remove"; readonly packName: string };
  /** Complete before/after reconciliation is limited to these Practice IDs. */
  affectedPracticeIds: readonly string[];
}

function assertStateIsCoherent(state: DerivedStoreState): void {
  if (
    !Number.isSafeInteger(state.generation) ||
    state.generation < 0 ||
    !Number.isSafeInteger(state.effectiveRevision) ||
    state.effectiveRevision < 0
  ) {
    throw new SqliteStateError("generation or effective revision is invalid");
  }
  const packNames = new Set(state.activePacks.map((pack) => pack.packName));
  for (const effective of state.effectivePractices) {
    const canonical = canonicalizePractice(effective.practice);
    if (
      effective.sources.length === 0 ||
      canonical.canonicalContent !== effective.canonicalContent ||
      canonical.contentDigest !== effective.contentDigest ||
      canonical.practice.id !== effective.practiceId
    ) {
      throw new SqliteStateError("Effective Practice is inconsistent with canonical content");
    }
    for (const source of effective.sources) {
      if (
        !packNames.has(source.packName) ||
        source.practiceId !== effective.practiceId ||
        source.contentDigest !== effective.contentDigest ||
        source.canonicalPractice.canonicalContent !== effective.canonicalContent ||
        source.canonicalPractice.contentDigest !== effective.contentDigest ||
        !isPracticeSourcePath(source.sourcePath)
      ) {
        throw new SqliteStateError("Effective Practice source is inconsistent with derived state");
      }
    }
  }
}

function insertEffectivePracticeRows(
  database: LocalStoreDatabase,
  practices: readonly EffectivePractice[],
  revisionFor: (practice: EffectivePractice) => number,
  metrics?: MutationMetricsObserver,
): void {
  for (const effective of practices) {
    const practice = effective.practice;
    database
      .insert(effectivePractices)
      .values({
        practiceId: effective.practiceId,
        contentDigest: effective.contentDigest,
        canonicalContent: effective.canonicalContent,
        title: practice.title,
        stage: practice.stage,
        techStackJson: JSON.stringify(practice.tech_stack),
        appliesWhen: practice.applies_when,
        severity: practice.severity ?? "warn",
        effectiveRevision: revisionFor(effective),
      })
      .run();
    metrics?.recordWrite("effective_practices", 1);
    for (const source of effective.sources) {
      database
        .insert(practiceSources)
        .values({
          packName: source.packName,
          practiceId: source.practiceId,
          contentDigest: source.contentDigest,
          sourcePath: source.sourcePath,
        })
        .run();
      metrics?.recordWrite("practice_sources", 1);
    }
  }
}

function writeRevisionRecords(
  database: LocalStoreDatabase,
  state: DerivedStoreState,
  metrics?: MutationMetricsObserver,
): void {
  if (state.clearRevisionLog === true) {
    const deleted = database.delete(effectiveRevisionLog).returning().all();
    metrics?.recordWrite("effective_revision_log", deleted.length);
  }
  if (state.revisionNotification?.supersedesPending === true) {
    database.delete(effectiveRevisionOutbox).run();
  }
  if (state.revisionNotification !== undefined) {
    database
      .insert(effectiveRevisionOutbox)
      .values({
        revision: state.effectiveRevision,
        deltaJson: serializeRevisionDelta(state.revisionNotification.delta),
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: effectiveRevisionOutbox.revision,
        set: {
          deltaJson: serializeRevisionDelta(state.revisionNotification.delta),
          createdAt: new Date().toISOString(),
        },
      })
      .run();
    metrics?.recordWrite("effective_revision_outbox", 1);
  }
  if (state.revisionLogDelta !== undefined) {
    appendEffectiveRevisionLog(database, state.effectiveRevision, state.revisionLogDelta);
    metrics?.recordWrite("effective_revision_log", 1);
  }
}

/** Replaces SQLite's fully-derived LocalStore state in one write transaction. */
export function writeDerivedState(database: LocalStoreDatabase, state: DerivedStoreState): void {
  assertStateIsCoherent(state);
  try {
    database.transaction(() => {
      database.delete(practiceSources).run();
      database.delete(effectivePractices).run();
      database.delete(activePacks).run();
      database.delete(localStoreMetadata).run();

      for (const pack of state.activePacks) {
        database
          .insert(activePacks)
          .values({
            packName: pack.packName,
            packVersion: pack.packVersion,
            artifactDigest: pack.artifactDigest,
            storageKey: pack.storageKey,
            installedAt: pack.installedAt,
          })
          .run();
      }

      insertEffectivePracticeRows(
        database,
        state.effectivePractices,
        () => state.effectiveRevision,
      );

      database
        .insert(localStoreMetadata)
        .values({
          singleton: 1,
          schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
          installedPacksGeneration: state.generation,
          effectiveRevision: state.effectiveRevision,
        })
        .run();

      writeRevisionRecords(database, state);
    });
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot write LocalStore derived state", error);
  }
}

function uniqueSortedIds(ids: readonly string[]): readonly string[] {
  const result = [...new Set(ids)].sort();
  if (result.length !== ids.length) {
    throw new SqliteStateError("affected Practice IDs must be unique");
  }
  return result;
}

function rowRevisions(
  database: LocalStoreDatabase,
  ids: readonly string[],
  metrics?: MutationMetricsObserver,
): ReadonlyMap<string, number> {
  if (ids.length === 0) return new Map();
  const rows = database
    .select({
      practiceId: effectivePractices.practiceId,
      effectiveRevision: effectivePractices.effectiveRevision,
    })
    .from(effectivePractices)
    .where(inArray(effectivePractices.practiceId, ids))
    .all();
  metrics?.recordRead("effective_practices", rows.length);
  const revisions = new Map<string, number>();
  for (const row of rows) {
    if (
      typeof row.practiceId !== "string" ||
      typeof row.effectiveRevision !== "number" ||
      !Number.isSafeInteger(row.effectiveRevision) ||
      row.effectiveRevision < 0
    ) {
      throw new SqliteStateError("stored Effective Practice revision is malformed");
    }
    revisions.set(row.practiceId, row.effectiveRevision);
  }
  return revisions;
}

function changedPracticeIds(delta: RevisionDelta | undefined): ReadonlySet<string> {
  return new Set(delta === undefined ? [] : [...delta.added, ...delta.changed]);
}

/**
 * Apply one lifecycle reconciliation without rewriting unrelated canonical
 * rows. The journal and metadata tuple make this transaction the SQLite half
 * of the existing cross-medium commit protocol; `writeDerivedState` remains
 * the full-rebuild path for reindex.
 */
export function applyIncrementalDerivedState(
  database: LocalStoreDatabase,
  state: IncrementalDerivedStoreState,
  metrics?: MutationMetricsObserver,
): void {
  assertStateIsCoherent(state);
  const affectedIds = uniqueSortedIds(state.affectedPracticeIds);
  const affected = new Set(affectedIds);
  for (const effective of state.effectivePractices) {
    if (!affected.has(effective.practiceId)) {
      throw new SqliteStateError("incremental Effective Practice is outside the affected set");
    }
  }
  try {
    database.transaction(() => {
      const priorRevisions = rowRevisions(database, affectedIds, metrics);
      if (state.activePackMutation.kind === "upsert") {
        const entry = state.activePackMutation.entry;
        database
          .insert(activePacks)
          .values({
            packName: entry.packName,
            packVersion: entry.packVersion,
            artifactDigest: entry.artifactDigest,
            storageKey: entry.storageKey,
            installedAt: entry.installedAt,
          })
          .onConflictDoUpdate({
            target: activePacks.packName,
            set: {
              packVersion: entry.packVersion,
              artifactDigest: entry.artifactDigest,
              storageKey: entry.storageKey,
              installedAt: entry.installedAt,
            },
          })
          .run();
        metrics?.recordWrite("active_packs", 1);
      }

      if (affectedIds.length > 0) {
        const sourceDelete = database
          .delete(practiceSources)
          .where(inArray(practiceSources.practiceId, affectedIds))
          .returning()
          .all();
        metrics?.recordWrite("practice_sources", sourceDelete.length);
        const effectiveDelete = database
          .delete(effectivePractices)
          .where(inArray(effectivePractices.practiceId, affectedIds))
          .returning()
          .all();
        metrics?.recordWrite("effective_practices", effectiveDelete.length);
      }

      if (state.activePackMutation.kind === "remove") {
        const packDelete = database
          .delete(activePacks)
          .where(eq(activePacks.packName, state.activePackMutation.packName))
          .returning()
          .all();
        metrics?.recordWrite("active_packs", packDelete.length);
      }

      const changedIds = changedPracticeIds(state.revisionLogDelta);
      insertEffectivePracticeRows(
        database,
        state.effectivePractices,
        (effective) => {
          const priorRevision = priorRevisions.get(effective.practiceId);
          const rowRevision = changedIds.has(effective.practiceId)
            ? state.effectiveRevision
            : priorRevision;
          if (rowRevision === undefined) {
            throw new SqliteStateError("unchanged Effective Practice has no prior revision");
          }
          return rowRevision;
        },
        metrics,
      );

      database
        .insert(localStoreMetadata)
        .values({
          singleton: 1,
          schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
          installedPacksGeneration: state.generation,
          effectiveRevision: state.effectiveRevision,
        })
        .onConflictDoUpdate({
          target: localStoreMetadata.singleton,
          set: {
            schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
            installedPacksGeneration: state.generation,
            effectiveRevision: state.effectiveRevision,
          },
        })
        .run();
      metrics?.recordWrite("local_store_metadata", 1);

      writeRevisionRecords(database, state, metrics);
    });
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot incrementally write LocalStore derived state", error);
  }
}
