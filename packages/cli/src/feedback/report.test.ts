import { expect, test } from "bun:test";

import {
  parseFeedbackDraftInput,
  renderReportMarkdown,
  reportFromInput,
  reportFromTrace,
} from "./report";

test("keeps explicitly selected local raw evidence while flagging credential-like text for external review", () => {
  const report = reportFromInput(
    parseFeedbackDraftInput({
      schemaVersion: 2,
      kind: "bug",
      summary: "Native startup failed",
      observed: "The process exited before readiness.",
      selected: {
        query: "exact user query\r\nBearer local-only-token",
        nativeOutput: "native output\nline two",
        paths: ["/absolute/model.gguf"],
      },
    }),
  );
  const markdown = renderReportMarkdown(report);
  expect(report.evidence).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "query",
        text: "exact user query\r\nBearer local-only-token",
      }),
      expect.objectContaining({ type: "native-output", text: "native output\nline two" }),
      expect.objectContaining({ type: "path", text: "/absolute/model.gguf" }),
    ]),
  );
  expect(report.externalReview).toMatchObject({
    required: true,
    selectedRawFields: expect.arrayContaining(["query", "native-output", "path"]),
    credentialSignals: ["Bearer-like text"],
  });
  expect(markdown).toContain("Bearer local-only-token");
});

test("rejects unbounded or open advanced input before it can become an artifact", () => {
  expect(() =>
    parseFeedbackDraftInput({
      schemaVersion: 2,
      kind: "bug",
      summary: "valid",
      observed: "valid",
      unexpected: "no open fields",
    }),
  ).toThrow(TypeError);
  expect(() =>
    parseFeedbackDraftInput({
      schemaVersion: 2,
      kind: "bug",
      summary: "x".repeat(257),
      observed: "valid",
    }),
  ).toThrow(TypeError);
});

test("keeps trace facts but does not fabricate missing local evidence", () => {
  const traceId = "00000000-0000-4000-8000-000000000021" as never;
  const report = reportFromTrace(traceId, "bug", {
    traceId,
    facts: [
      {
        event: "native.exited-before-ready",
        time: "2026-09-18T00:00:00.000Z",
        preparationId: "preparation-1",
        readiness: "failed",
        exitCode: 0,
        stdoutBytes: 0,
        stderrBytes: 0,
      },
    ],
    missingEvidence: ["diagnostic-log-rotated"],
  });
  expect(report.evidence).toContainEqual(
    expect.objectContaining({ type: "diagnostic-facts", traceId }),
  );
  expect(report.missingEvidence).toEqual(["diagnostic-log-rotated"]);
  expect(renderReportMarkdown(report)).toContain('"exitCode": 0');
});

test("keeps real identities in the local report while making the Markdown share view anonymous", () => {
  const traceId = "00000000-0000-4000-8000-000000000025" as never;
  const nativeRunId = "native-private-identity";
  const report = reportFromTrace(traceId, "bug", {
    traceId,
    facts: [
      {
        event: "native.exited-before-ready",
        time: "2026-09-18T00:00:00.000Z",
        requestId: "request-private-identity",
        operationId: "operation-private-identity",
        preparationId: "preparation-private-identity",
        nativeRunId,
        readiness: "failed",
        exitCode: 0,
        stdoutBytes: 0,
        stderrBytes: 0,
      },
    ],
    missingEvidence: [],
  });
  const markdown = renderReportMarkdown(report);
  expect(JSON.stringify(report)).toContain(nativeRunId);
  expect(markdown).toContain("trace-1");
  expect(markdown).toContain("request-1");
  expect(markdown).toContain("operation-1");
  expect(markdown).toContain("preparation-1");
  expect(markdown).toContain("native-run-1");
  expect(markdown).not.toContain(traceId);
  expect(markdown).not.toContain(nativeRunId);
});
