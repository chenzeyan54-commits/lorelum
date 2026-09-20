import {
  allowsLogLevel,
  collectTraceLogs,
  type LogLevel,
  type LogRecord,
  type TraceId,
} from "@lorelum/log";
import { defaultLogDirectory } from "@lorelum/config";

export type FeedbackLogLevel = Extract<LogLevel, "info" | "debug">;

export interface TraceLogSelection {
  readonly traceId: TraceId;
  readonly level: FeedbackLogLevel;
  readonly records: readonly LogRecord[];
  readonly missingEvidence: readonly string[];
}

/** Reads only already-written records for one trace; it never starts a runtime or scans elsewhere. */
export async function readTraceLogs(
  traceId: TraceId,
  level: FeedbackLogLevel,
): Promise<TraceLogSelection> {
  const collection = await collectTraceLogs({
    rootDirectory: defaultLogDirectory(),
    traceId,
    limit: 1_000,
  });
  const records = collection.directRecords.filter((record) => allowsLogLevel(level, record.level));
  return {
    traceId,
    level,
    records,
    missingEvidence:
      records.length === 0
        ? [...collection.missing, "detailed-logs-not-found"]
        : collection.missing,
  };
}
