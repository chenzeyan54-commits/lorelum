import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLogRecord } from "@lorelum/log";

import { run } from "../main.js";

class MemoryWriter {
  value = "";
  write(message: string): void {
    this.value += message;
  }
}

test("views one trace through the public logs command and prunes only managed files", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-cli-logs-"));
  try {
    const traceId = "00000000-0000-4000-8000-000000000301" as never;
    const directory = join(root, "cli", "2026-09-18");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "fixture.jsonl"),
      `${JSON.stringify(
        createLogRecord({
          level: "debug",
          source: "cli.query",
          message: "query.requested",
          traceId,
          query: "trace-specific query",
        }),
      )}\n`,
    );
    const stdout = new MemoryWriter();
    const stderr = new MemoryWriter();
    expect(
      await run(["--json", "logs", "--trace-id", traceId], { stdout, stderr, logDirectory: root }),
    ).toBe(0);
    const response = JSON.parse(stdout.value);
    expect(response).toMatchObject({
      command: "logs",
      ok: true,
      data: { records: [{ traceId, message: "query.requested" }] },
    });

    const prune = new MemoryWriter();
    expect(await run(["--json", "logs", "prune"], { stdout: prune, logDirectory: root })).toBe(0);
    expect(JSON.parse(prune.value)).toMatchObject({
      command: "logs",
      ok: true,
      data: { deletedFiles: 0, deletedBytes: 0 },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("debug is a per-invocation persistent collection override", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-cli-debug-"));
  try {
    const stdout = new MemoryWriter();
    const traceId = "00000000-0000-4000-8000-000000000302" as never;
    expect(await run(["--debug"], { stdout, logDirectory: root, traceId })).toBe(0);
    const logs = new MemoryWriter();
    expect(
      await run(["--json", "logs", "--trace-id", traceId, "--level", "debug"], {
        stdout: logs,
        logDirectory: root,
      }),
    ).toBe(0);
    expect(JSON.parse(logs.value).data.records).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: "command.debug-enabled" })]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
