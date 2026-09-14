import { asc, desc, gt, lt } from "drizzle-orm";

import type { RevisionDelta } from "../../model";
import { effectiveRevisionLog } from "../../../persistence/schemas/local-store";
import type { LocalStoreDatabase } from "../../../persistence/schemas/database-types";

import { SqliteStateError } from "../errors";
import { parseRevisionDelta, serializeRevisionDelta } from "./revision-delta";

export interface EffectiveRevisionLogEntry {
  readonly revision: number;
  readonly delta: RevisionDelta;
}

export const EFFECTIVE_REVISION_LOG_RETENTION = 1_024;

function assertRevision(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new SqliteStateError("effective revision log row is malformed");
  }
}

/** Append a canonical-state change record in the caller's write transaction. */
export function appendEffectiveRevisionLog(
  database: LocalStoreDatabase,
  revision: number,
  delta: RevisionDelta,
): void {
  try {
    assertRevision(revision);
    database
      .insert(effectiveRevisionLog)
      .values({
        revision,
        deltaJson: serializeRevisionDelta(delta),
        createdAt: new Date().toISOString(),
      })
      .run();
    const latest = database
      .select({ revision: effectiveRevisionLog.revision })
      .from(effectiveRevisionLog)
      .orderBy(desc(effectiveRevisionLog.revision))
      .limit(1)
      .get();
    const minimumRevision = (latest?.revision ?? 0) - (EFFECTIVE_REVISION_LOG_RETENTION - 1);
    if (minimumRevision > 0) {
      database
        .delete(effectiveRevisionLog)
        .where(lt(effectiveRevisionLog.revision, minimumRevision))
        .run();
    }
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot append effective revision log", error);
  }
}

/** Read retained change records after a checkpoint, in strict revision order. */
export function readEffectiveRevisionLog(
  database: LocalStoreDatabase,
  afterRevision: number,
): readonly EffectiveRevisionLogEntry[] {
  try {
    assertRevision(afterRevision);
    const rows = database
      .select({
        revision: effectiveRevisionLog.revision,
        deltaJson: effectiveRevisionLog.deltaJson,
      })
      .from(effectiveRevisionLog)
      .where(gt(effectiveRevisionLog.revision, afterRevision))
      .orderBy(asc(effectiveRevisionLog.revision))
      .all();
    return Object.freeze(
      rows.map((row) => {
        assertRevision(row.revision);
        if (typeof row.deltaJson !== "string") {
          throw new SqliteStateError("effective revision log row is malformed");
        }
        return Object.freeze({ revision: row.revision, delta: parseRevisionDelta(row.deltaJson) });
      }),
    );
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot read effective revision log", error);
  }
}
