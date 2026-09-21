import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogRecord } from "@lorelum/log";

import { readTraceLogs } from "./logs";

test("reads the complete safe trace chain at info and appends debug only when recorded", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-feedback-logs-"));
  const traceId = "00000000-0000-4000-8000-000000000027" as never;
  const siblingTraceId = "00000000-0000-4000-8000-000000000028" as never;
  try {
    const directory = join(root, "backend");
    await mkdir(directory, { recursive: true });
    const records = [
      createLogRecord({
        time: "2026-09-21T00:00:00.000Z",
        level: "info",
        source: "cli.query",
        message: "query.requested",
        traceId,
        operationId: "operation-1",
        query: "ordinary local query",
      }),
      createLogRecord({
        time: "2026-09-21T00:00:01.000Z",
        level: "error",
        source: "cli.query",
        message: "query.failed",
        traceId,
        operationId: "operation-1",
        error: new Error("ordinary local stack"),
      }),
      createLogRecord({
        time: "2026-09-21T00:00:02.000Z",
        level: "debug",
        source: "backend.operation",
        message: "operation.debug",
        operationId: "operation-1",
        detail: "previously recorded debug detail",
      }),
      createLogRecord({
        time: "2026-09-21T00:00:03.000Z",
        level: "info",
        source: "backend.operation",
        message: "operation.completed",
        operationId: "operation-1",
        result: "safe shared lifecycle evidence",
      }),
      createLogRecord({
        time: "2026-09-21T00:00:04.000Z",
        level: "info",
        source: "cli.query",
        message: "sibling.query",
        traceId: siblingTraceId,
        operationId: "operation-1",
        query: "must not cross trace boundary",
      }),
    ];
    await writeFile(
      join(directory, "current.jsonl"),
      `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    );

    const info = await readTraceLogs(traceId, "info", { logDirectory: root });
    expect(info.records.map((record) => record.message)).toEqual([
      "query.requested",
      "query.failed",
      "operation.completed",
    ]);
    expect(JSON.stringify(info.records)).toContain("ordinary local query");
    expect(JSON.stringify(info.records)).toContain("ordinary local stack");
    expect(JSON.stringify(info.records)).toContain("safe shared lifecycle evidence");
    expect(JSON.stringify(info.records)).not.toContain("must not cross trace boundary");

    const debug = await readTraceLogs(traceId, "debug", { logDirectory: root });
    expect(debug.records.map((record) => record.message)).toEqual([
      "query.requested",
      "query.failed",
      "operation.debug",
      "operation.completed",
    ]);
    expect(debug.missingEvidence).not.toContain("debug-records-not-found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports when a trace has no previously recorded debug detail", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-feedback-no-debug-"));
  const traceId = "00000000-0000-4000-8000-000000000029" as never;
  try {
    const directory = join(root, "cli");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "current.jsonl"),
      `${JSON.stringify(
        createLogRecord({
          level: "info",
          source: "cli.query",
          message: "query.requested",
          traceId,
          query: "already recorded normal detail",
        }),
      )}\n`,
    );
    const debug = await readTraceLogs(traceId, "debug", { logDirectory: root });
    expect(debug.records).toHaveLength(1);
    expect(debug.missingEvidence).toContain("debug-records-not-found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
