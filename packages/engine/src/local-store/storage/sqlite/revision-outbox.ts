import { asc, eq } from "drizzle-orm";

import type { RevisionDelta } from "../../model";
import { effectiveRevisionOutbox } from "../../../persistence/schemas/local-store";
import type { LocalStoreDatabase } from "../../../persistence/schemas/database-types";
import { SqliteStateError } from "../errors";
import { parseRevisionDelta } from "./revision-delta";

export interface PendingRevisionNotification {
  readonly revision: number;
  readonly delta: RevisionDelta;
}

/** Read durable notifications in revision order. */
export function readPendingRevisionNotifications(
  database: LocalStoreDatabase,
): readonly PendingRevisionNotification[] {
  try {
    const rows = database
      .select({
        revision: effectiveRevisionOutbox.revision,
        deltaJson: effectiveRevisionOutbox.deltaJson,
      })
      .from(effectiveRevisionOutbox)
      .orderBy(asc(effectiveRevisionOutbox.revision))
      .all();
    return Object.freeze(
      rows.map((row) => {
        if (
          typeof row.revision !== "number" ||
          !Number.isSafeInteger(row.revision) ||
          row.revision < 0 ||
          typeof row.deltaJson !== "string"
        ) {
          throw new SqliteStateError("revision outbox row is malformed");
        }
        return Object.freeze({
          revision: row.revision,
          delta: parseRevisionDelta(row.deltaJson),
        });
      }),
    );
  } catch (error) {
    if (error instanceof SqliteStateError) throw error;
    throw new SqliteStateError("cannot read revision outbox", error);
  }
}

export function deletePendingRevisionNotification(
  database: LocalStoreDatabase,
  revision: number,
): void {
  try {
    database
      .delete(effectiveRevisionOutbox)
      .where(eq(effectiveRevisionOutbox.revision, revision))
      .run();
  } catch (error) {
    throw new SqliteStateError("cannot acknowledge revision notification", error);
  }
}
