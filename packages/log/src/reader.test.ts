import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLogRecord } from "./record.js";
import { pruneManagedLogs, readManagedLogs } from "./reader.js";

test("reads only managed JSONL records and filters one trace", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-log-reader-"));
  try {
    const directory = join(root, "cli", "2026-09-18");
    await mkdir(directory, { recursive: true });
    const one = createLogRecord({
      level: "info",
      source: "cli.query",
      message: "completed",
      traceId: "00000000-0000-4000-8000-000000000101" as never,
      query: "one",
    });
    const two = createLogRecord({
      level: "debug",
      source: "cli.query",
      message: "completed",
      traceId: "00000000-0000-4000-8000-000000000102" as never,
      query: "two",
    });
    await writeFile(
      join(directory, "first.jsonl"),
      `${JSON.stringify(one)}\n${JSON.stringify(two)}\n`,
    );
    const result = await readManagedLogs({
      rootDirectory: root,
      traceId: one.traceId!,
    });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.context).toMatchObject({ query: "one" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prunes only expired managed JSONL files", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-log-prune-"));
  try {
    await mkdir(join(root, "cli"));
    const old = join(root, "cli", "old.jsonl");
    const current = join(root, "cli", "current.jsonl");
    await writeFile(old, "{}\n");
    await writeFile(current, "{}\n");
    const result = await pruneManagedLogs({
      rootDirectory: root,
      now: Date.now() + 2 * 86_400_000,
      maxAgeDays: 1,
    });
    expect(result.deletedFiles).toBe(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
