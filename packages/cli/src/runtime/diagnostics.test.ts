import { createLogRecord, createTraceId } from "@lorelum/log";
import { expect, test } from "bun:test";

import { CliStderrLogSink } from "./diagnostics.js";
import { Logger } from "./logger.js";

class MemoryWriter {
  value = "";

  write(message: string): void {
    this.value += message;
  }
}

test("serializes generic log records through the existing stderr logger", () => {
  const writer = new MemoryWriter();
  const logger = new Logger(writer);
  logger.setLevel("info");
  new CliStderrLogSink(logger).write(
    createLogRecord({
      time: "2026-09-18T00:00:00.000Z",
      level: "info",
      source: "cli",
      message: "command.started",
      traceId: createTraceId(),
      invocationId: "invocation-1",
    }),
  );

  expect(writer.value).toStartWith("[info] {");
  expect(writer.value).toContain('"message":"command.started"');
  expect(writer.value.endsWith("\n")).toBe(true);
});
