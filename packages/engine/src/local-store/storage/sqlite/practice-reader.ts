import { asc, eq } from "drizzle-orm";

import type { EffectivePractice } from "../../model";
import { effectivePractices, practiceSources } from "../../../persistence/schemas/local-store";
import type { LocalStoreDatabase } from "../../../persistence/schemas/database-types";
import { materializePracticeRows } from "./row-materializer";
import type { StoreMetadataSnapshot } from "./snapshot-reader";

/** Run inside the caller's metadata read transaction. */
export function readPractice(
  database: LocalStoreDatabase,
  metadata: StoreMetadataSnapshot,
  practiceId: string,
): EffectivePractice | undefined {
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
    .where(eq(effectivePractices.practiceId, practiceId))
    .orderBy(asc(practiceSources.packName), asc(practiceSources.sourcePath))
    .all();
  return materializePracticeRows(rows, metadata)[0];
}
