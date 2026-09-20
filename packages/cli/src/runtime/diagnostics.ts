import {
  serializeLogRecord,
  createLogRecord,
  type LogEventInput,
  type LogRecord,
  type LogSink,
} from "@lorelum/log";

import { Logger } from "./logger.js";

/** Keeps diagnostics on stderr through the existing level-aware logger facade. */
export class CliStderrLogSink implements LogSink {
  constructor(private readonly logger: Logger) {}

  write(record: LogEventInput | LogRecord): void {
    const normalized = createLogRecord(record);
    this.logger.log(normalized.level, serializeLogRecord(normalized).trimEnd());
  }
}
