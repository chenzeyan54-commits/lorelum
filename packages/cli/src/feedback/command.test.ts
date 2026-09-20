import { expect, test } from "bun:test";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogRecord } from "@lorelum/log";

import { snapshotCommandDefinitions } from "../registry";
import { run } from "../main";
import { publishFeedbackArtifact } from "./artifacts";
import { createFeedbackCommand } from "./command";

class MemoryWriter {
  value = "";
  write(message: string) {
    this.value += message;
  }
}

test("trace-rooted draft writes local artifacts while stdout contains only the envelope", async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), "lorelum-feedback-command-")));
  const traceId = "00000000-0000-4000-8000-000000000022" as never;
  const stdout = new MemoryWriter();
  try {
    const command = createFeedbackCommand({
      defaultOutputDirectory: () => parent,
      readInput: async () => {
        throw new Error("trace draft must not read an input file");
      },
      publish: publishFeedbackArtifact,
      readTraceDiagnostics: async () => ({
        traceId,
        facts: [
          {
            event: "backend.request.started",
            time: "2026-09-18T00:00:00.000Z",
            traceId,
            requestId: "request-1",
            route: "query",
            query: "raw query stays local",
          },
        ],
        missingEvidence: [],
      }),
    });
    expect(
      await run(["--json", "feedback", "draft", "--trace-id", traceId, "--kind", "bug"], {
        registry: snapshotCommandDefinitions([command]),
        stdout,
      }),
    ).toBe(0);
    expect(stdout.value.trim().split("\n")).toHaveLength(1);
    expect(stdout.value).not.toContain("raw query stays local");
    const response = JSON.parse(stdout.value) as {
      data: { reportPath: string; markdownPath: string; externalReview: { required: boolean } };
    };
    expect(response).toMatchObject({
      command: "feedback.draft",
      ok: true,
      data: { state: "draft" },
    });
    expect(response.data.externalReview.required).toBe(false);
    expect(await readFile(response.data.reportPath, "utf8")).not.toContain("raw query stays local");
    expect(await readFile(response.data.markdownPath, "utf8")).toContain("Local draft only");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("detailed trace logs are included only after an explicit request", async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), "lorelum-feedback-detail-")));
  const traceId = "00000000-0000-4000-8000-000000000024" as never;
  try {
    const command = createFeedbackCommand({
      defaultOutputDirectory: () => parent,
      readInput: async () => "",
      publish: publishFeedbackArtifact,
      readTraceDiagnostics: async () => ({ traceId, facts: [], missingEvidence: [] }),
      readTraceLogs: async () => ({
        traceId,
        level: "debug",
        records: [
          createLogRecord({
            level: "debug",
            source: "cli.query",
            message: "query.requested",
            traceId,
            query: "selected detailed query",
          }),
        ],
        missingEvidence: [],
      }),
    });
    const stdout = new MemoryWriter();
    expect(
      await run(
        [
          "--json",
          "feedback",
          "draft",
          "--trace-id",
          traceId,
          "--kind",
          "bug",
          "--include-logs",
          "debug",
        ],
        {
          registry: snapshotCommandDefinitions([command]),
          stdout,
        },
      ),
    ).toBe(0);
    const response = JSON.parse(stdout.value) as {
      data: { reportPath: string; externalReview: { required: boolean } };
    };
    expect(response.data.externalReview.required).toBe(true);
    expect(await readFile(response.data.reportPath, "utf8")).toContain("selected detailed query");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("invalid feedback arguments publish no local artifact", async () => {
  let published = 0;
  const stdout = new MemoryWriter();
  const stderr = new MemoryWriter();
  const command = createFeedbackCommand({
    defaultOutputDirectory: () => "/unused",
    readInput: async () => "{}",
    readTraceDiagnostics: async () => ({
      traceId: "00000000-0000-4000-8000-000000000023" as never,
      facts: [],
      missingEvidence: [],
    }),
    publish: async () => {
      published++;
      return { reportPath: "/unused/report.json", markdownPath: "/unused/report.md" };
    },
  });
  expect(
    await run(["--json", "feedback", "draft", "--trace-id", "not-a-trace", "--kind", "bug"], {
      registry: snapshotCommandDefinitions([command]),
      stdout,
      stderr,
    }),
  ).toBe(2);
  expect(published).toBe(0);
  expect(stderr.value).toBe("");
  expect(JSON.parse(stdout.value)).toMatchObject({ ok: false, error: { code: "usage.invalid" } });
});

test("advanced input remains out of argv and stdout while selected local content enters the artifact", async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), "lorelum-feedback-input-")));
  const stdout = new MemoryWriter();
  try {
    const command = createFeedbackCommand({
      defaultOutputDirectory: () => parent,
      readTraceDiagnostics: async () => {
        throw new Error("input draft must not read trace diagnostics");
      },
      readInput: async (source) => {
        expect(source).toBe("manual.json");
        return JSON.stringify({
          schemaVersion: 2,
          kind: "improvement",
          summary: "A useful gap",
          observed: "The current guidance omitted a decision boundary.",
          selected: { query: "manual local query", conversationExcerpt: "user context" },
        });
      },
      publish: publishFeedbackArtifact,
    });
    expect(
      await run(["--json", "feedback", "draft", "--input", "manual.json", "--output", parent], {
        registry: snapshotCommandDefinitions([command]),
        stdout,
      }),
    ).toBe(0);
    expect(stdout.value).not.toContain("manual local query");
    const response = JSON.parse(stdout.value) as { data: { reportPath: string } };
    expect(await readFile(response.data.reportPath, "utf8")).toContain("manual local query");
    expect(await readFile(response.data.reportPath, "utf8")).toContain("conversation-excerpt");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
