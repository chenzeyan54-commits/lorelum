import { expect, test } from "bun:test";

import { createLogRecord, serializeLogRecord } from "./record";

test("serializes a native Error when an event supplies an explicit timestamp", () => {
  const record = createLogRecord({
    time: "2026-09-21T00:00:00.000Z",
    level: "error",
    source: "cli.query",
    message: "query.failed",
    error: new Error("preserve this stack"),
  });
  expect(record.error).toEqual(
    expect.objectContaining({ name: "Error", message: "preserve this stack" }),
  );
  expect(record.error?.stack).toContain("preserve this stack");
  expect(serializeLogRecord(record)).toContain("preserve this stack");
});
