import { expect, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SemanticOperationJournal } from "./project-operation-journal";

const digest = "a".repeat(64);

test("persists opaque project targets and converts interrupted work to waiting-for-source", async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "lorelum-project-operation-journal-")),
  );
  try {
    const journal = new SemanticOperationJournal(directory);
    await journal.upsert({
      operationId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      targetKind: "project",
      sourceId: digest,
      targetSlotId: "b".repeat(64),
      cacheScopeId: "f".repeat(64),
      artifactId: "c".repeat(64),
      corpusDigest: "d".repeat(64),
      profileId: "e".repeat(64),
      state: "building",
      indexedPracticeCount: 50,
      totalPracticeCount: 100,
      attempts: 1,
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    });
    await expect(journal.recover()).resolves.toMatchObject([
      {
        state: "waiting-for-source",
        indexedPracticeCount: 50,
        totalPracticeCount: 100,
      },
    ]);
    const raw = await readFile(join(directory, "semantic-index-operations.json"), "utf8");
    expect(raw).not.toContain("/Users/");
    expect(raw).not.toContain("Practice:");
    expect(raw).not.toContain("cacheRoot");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retains allowlisted terminal failures and accepts legacy failures without an error", async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "lorelum-project-operation-failure-journal-")),
  );
  const record = {
    operationId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    targetKind: "store" as const,
    sourceId: digest,
    targetSlotId: "b".repeat(64),
    cacheScopeId: "f".repeat(64),
    artifactId: "c".repeat(64),
    corpusDigest: "d".repeat(64),
    profileId: "e".repeat(64),
    state: "failed" as const,
    indexedPracticeCount: 0,
    totalPracticeCount: 1,
    attempts: 1,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
  };
  try {
    const journal = new SemanticOperationJournal(directory);
    await journal.upsert({ ...record, error: "embedding.download-failed" });
    await expect(journal.recover()).resolves.toEqual([
      expect.objectContaining({ state: "failed", error: "embedding.download-failed" }),
    ]);
    const persisted = await readFile(join(directory, "semantic-index-operations.json"), "utf8");
    expect(persisted).not.toContain("/Users/");
    expect(persisted).not.toContain("download failed:");

    await writeFile(
      join(directory, "semantic-index-operations.json"),
      JSON.stringify({ operations: [record] }),
      { mode: 0o600 },
    );
    await expect(journal.findById(record.operationId)).resolves.toEqual(record);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
