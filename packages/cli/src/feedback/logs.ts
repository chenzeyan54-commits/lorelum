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

export interface ReadTraceLogsOptions {
  /** Test-only managed log root override; production uses `~/.lorelum/logs`. */
  readonly logDirectory?: string;
}

/** Reads only already-written records for one trace; it never starts a runtime or scans elsewhere. */
export async function readTraceLogs(
  traceId: TraceId,
  level: FeedbackLogLevel,
  options: ReadTraceLogsOptions = {},
): Promise<TraceLogSelection> {
  const collection = await collectTraceLogs({
    rootDirectory: options.logDirectory ?? defaultLogDirectory(),
    traceId,
    limit: 1_000,
  });
  const records = [...collection.directRecords, ...collection.sharedRecords]
    .filter((record) => allowsLogLevel(level, record.level))
    .sort((left, right) => left.time.localeCompare(right.time));
  const missingEvidence = [
    ...collection.missing,
    ...(records.length === 0 ? ["detailed-logs-not-found"] : []),
    ...(level === "debug" && !records.some((record) => record.level === "debug")
      ? ["debug-records-not-found"]
      : []),
  ];
  return {
    traceId,
    level,
    records,
    missingEvidence: [...new Set(missingEvidence)],
  };
}
