import type { TraceDiagnosticFact, TraceDiagnosticProjection } from "@lorelum/backend/diagnostics";
import { isTraceId, type TraceId } from "@lorelum/log";

import { toolVersion } from "../output/protocol.js";
import {
  feedbackDispositions,
  feedbackKinds,
  type FeedbackDiagnosticFact,
  type FeedbackDisposition,
  type FeedbackDraftInput,
  type FeedbackEvidence,
  type FeedbackExternalReview,
  type FeedbackKind,
  type FeedbackReport,
} from "./types.js";
import type { TraceLogSelection } from "./logs.js";

const MAX_TEXT_BYTES = 8_192;
const MAX_SUMMARY_BYTES = 256;
const MAX_REPRODUCTION_STEPS = 12;
const MAX_EVIDENCE_ITEMS = 24;

function validText(value: unknown, maximum = MAX_TEXT_BYTES): value is string {
  return (
    typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= maximum
  );
}

function optionalText(value: unknown, maximum = MAX_TEXT_BYTES): string | undefined {
  return value === undefined ? undefined : validText(value, maximum) ? value : undefined;
}

function isKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (feedbackKinds as readonly string[]).includes(value);
}

function isDisposition(value: unknown): value is FeedbackDisposition {
  return typeof value === "string" && (feedbackDispositions as readonly string[]).includes(value);
}

function stringArray(value: unknown, maximum: number): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => !validText(item))) {
    return undefined;
  }
  return value;
}

/** Strict parser for the advanced, manually supplied feedback input contract. */
export function parseFeedbackDraftInput(value: unknown): FeedbackDraftInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Feedback input must be an object.");
  }
  const input = value as Record<string, unknown>;
  const allowed = new Set([
    "schemaVersion",
    "kind",
    "summary",
    "observed",
    "expected",
    "reproduction",
    "selected",
    "suggestedDisposition",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new TypeError("Feedback input contains unsupported fields.");
  }
  if (
    input.schemaVersion !== 2 ||
    !isKind(input.kind) ||
    !validText(input.summary, MAX_SUMMARY_BYTES) ||
    !validText(input.observed)
  ) {
    throw new TypeError("Feedback input is invalid.");
  }
  const expected = optionalText(input.expected);
  if (input.expected !== undefined && expected === undefined)
    throw new TypeError("Feedback expected text is invalid.");
  const reproduction =
    input.reproduction === undefined
      ? undefined
      : stringArray(input.reproduction, MAX_REPRODUCTION_STEPS);
  if (input.reproduction !== undefined && reproduction === undefined) {
    throw new TypeError("Feedback reproduction steps are invalid.");
  }
  let selected: FeedbackDraftInput["selected"];
  if (input.selected !== undefined) {
    if (
      typeof input.selected !== "object" ||
      input.selected === null ||
      Array.isArray(input.selected)
    ) {
      throw new TypeError("Feedback selected evidence is invalid.");
    }
    const selectedInput = input.selected as Record<string, unknown>;
    const allowedSelected = new Set([
      "query",
      "practiceContent",
      "paths",
      "nativeOutput",
      "rawError",
      "conversationExcerpt",
    ]);
    if (Object.keys(selectedInput).some((key) => !allowedSelected.has(key))) {
      throw new TypeError("Feedback selected evidence contains unsupported fields.");
    }
    const paths =
      selectedInput.paths === undefined
        ? undefined
        : stringArray(selectedInput.paths, MAX_EVIDENCE_ITEMS);
    if (selectedInput.paths !== undefined && paths === undefined)
      throw new TypeError("Feedback paths are invalid.");
    const fields = {
      query: optionalText(selectedInput.query),
      practiceContent: optionalText(selectedInput.practiceContent),
      nativeOutput: optionalText(selectedInput.nativeOutput),
      rawError: optionalText(selectedInput.rawError),
      conversationExcerpt: optionalText(selectedInput.conversationExcerpt),
      ...(paths === undefined ? {} : { paths }),
    };
    if (
      Object.entries(selectedInput).some(
        ([key, field]) =>
          key !== "paths" &&
          field !== undefined &&
          !(key in fields && fields[key as keyof typeof fields] !== undefined),
      )
    ) {
      throw new TypeError("Feedback selected evidence exceeds its text limit.");
    }
    selected = {
      ...(fields.query === undefined ? {} : { query: fields.query }),
      ...(fields.practiceContent === undefined ? {} : { practiceContent: fields.practiceContent }),
      ...(fields.nativeOutput === undefined ? {} : { nativeOutput: fields.nativeOutput }),
      ...(fields.rawError === undefined ? {} : { rawError: fields.rawError }),
      ...(fields.conversationExcerpt === undefined
        ? {}
        : { conversationExcerpt: fields.conversationExcerpt }),
      ...(paths === undefined ? {} : { paths }),
    };
  }
  if (input.suggestedDisposition !== undefined && !isDisposition(input.suggestedDisposition)) {
    throw new TypeError("Feedback disposition is invalid.");
  }
  return {
    schemaVersion: 2,
    kind: input.kind,
    summary: input.summary,
    observed: input.observed,
    ...(expected === undefined ? {} : { expected }),
    ...(reproduction === undefined ? {} : { reproduction }),
    ...(selected === undefined ? {} : { selected }),
    ...(input.suggestedDisposition === undefined
      ? {}
      : { suggestedDisposition: input.suggestedDisposition }),
  };
}

function factForReport(fact: TraceDiagnosticFact): FeedbackDiagnosticFact {
  return {
    event: fact.event,
    time: fact.time,
    ...(fact.requestId === undefined ? {} : { requestId: fact.requestId }),
    ...(fact.operationId === undefined ? {} : { operationId: fact.operationId }),
    ...(fact.preparationId === undefined ? {} : { preparationId: fact.preparationId }),
    ...(fact.nativeRunId === undefined ? {} : { nativeRunId: fact.nativeRunId }),
    ...(fact.route === undefined ? {} : { route: fact.route }),
    ...(fact.method === undefined ? {} : { method: fact.method }),
    ...(fact.status === undefined ? {} : { status: fact.status }),
    ...(fact.buildIdentity === undefined ? {} : { buildIdentity: fact.buildIdentity }),
    ...(fact.readiness === undefined ? {} : { readiness: fact.readiness }),
    ...(fact.exitCode === undefined ? {} : { exitCode: fact.exitCode }),
    ...(fact.signal === undefined ? {} : { signal: fact.signal }),
    ...(fact.stdoutBytes === undefined ? {} : { stdoutBytes: fact.stdoutBytes }),
    ...(fact.stderrBytes === undefined ? {} : { stderrBytes: fact.stderrBytes }),
    ...(fact.durationMs === undefined ? {} : { durationMs: fact.durationMs }),
    ...(fact.count === undefined ? {} : { count: fact.count }),
    ...(fact.code === undefined ? {} : { code: fact.code }),
  };
}

function rawEvidence(
  type: Extract<
    FeedbackEvidence["type"],
    "query" | "practice-content" | "path" | "native-output" | "raw-error" | "conversation-excerpt"
  >,
  text: string,
  source: "input" | "trace",
  traceId?: TraceId,
): FeedbackEvidence {
  return {
    type,
    source,
    text,
    ...(traceId === undefined ? {} : { traceId }),
  };
}

const credentialPatterns: readonly [RegExp, string][] = [
  [/\bBearer\s+\S+/i, "Bearer-like text"],
  [/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i, "private-key-like text"],
  [/\b(?:authorization|cookie)\s*[:=]/i, "credential-header-like text"],
];

function externalReview(evidence: readonly FeedbackEvidence[]): FeedbackExternalReview {
  const selectedRawFields = [
    ...new Set(
      evidence
        .filter((item) => item.type !== "diagnostic-facts" && item.type !== "user-observation")
        .map((item) => item.type),
    ),
  ];
  const credentialSignals = [
    ...new Set(
      evidence.flatMap((item) => {
        const text =
          "text" in item
            ? item.text
            : item.type === "detailed-logs"
              ? JSON.stringify(item.records)
              : "";
        return credentialPatterns
          .filter(([pattern]) => pattern.test(text))
          .map(([, signal]) => signal);
      }),
    ),
  ];
  return {
    required: credentialSignals.length > 0,
    selectedRawFields,
    credentialSignals,
  };
}

function contextualReport(
  input: FeedbackDraftInput,
  evidence: readonly FeedbackEvidence[],
): FeedbackReport {
  return {
    schemaVersion: 2,
    kind: input.kind,
    summary: input.summary,
    observed: input.observed,
    ...(input.expected === undefined ? {} : { expected: input.expected }),
    ...(input.reproduction === undefined ? {} : { reproduction: input.reproduction }),
    context: { cliVersion: toolVersion, platform: process.platform, arch: process.arch },
    evidence,
    missingEvidence: [],
    externalReview: externalReview(evidence),
    ...(input.suggestedDisposition === undefined
      ? {}
      : { suggestedDisposition: input.suggestedDisposition }),
  };
}

export function reportFromInput(input: FeedbackDraftInput): FeedbackReport {
  const evidence: FeedbackEvidence[] = [
    { type: "user-observation", source: "input", text: input.observed },
  ];
  const selected = input.selected;
  if (selected?.query !== undefined) evidence.push(rawEvidence("query", selected.query, "input"));
  if (selected?.practiceContent !== undefined)
    evidence.push(rawEvidence("practice-content", selected.practiceContent, "input"));
  for (const path of selected?.paths ?? []) evidence.push(rawEvidence("path", path, "input"));
  if (selected?.nativeOutput !== undefined)
    evidence.push(rawEvidence("native-output", selected.nativeOutput, "input"));
  if (selected?.rawError !== undefined)
    evidence.push(rawEvidence("raw-error", selected.rawError, "input"));
  if (selected?.conversationExcerpt !== undefined) {
    evidence.push(rawEvidence("conversation-excerpt", selected.conversationExcerpt, "input"));
  }
  return contextualReport(input, evidence);
}

export function reportFromTrace(
  traceId: TraceId,
  kind: FeedbackKind,
  projection: TraceDiagnosticProjection,
  detailed?: TraceLogSelection,
): FeedbackReport {
  if (!isTraceId(traceId)) throw new TypeError("Feedback trace ID is invalid.");
  const evidence: FeedbackEvidence[] = [];
  if (projection.facts.length > 0) {
    evidence.push({
      type: "diagnostic-facts",
      source: "summary",
      traceId,
      facts: projection.facts.map(factForReport),
    });
  }
  if (detailed !== undefined && detailed.records.length > 0) {
    evidence.push({
      type: "detailed-logs",
      source: "detailed-log",
      traceId,
      level: detailed.level,
      records: detailed.records,
    });
  }
  const report: FeedbackReport = {
    schemaVersion: 2,
    kind,
    summary: `Local ${kind} feedback from the selected trace`,
    observed:
      projection.facts.length === 0
        ? "The selected trace has no readable local diagnostic facts."
        : "This draft was generated from local diagnostics explicitly associated with the selected trace.",
    context: { cliVersion: toolVersion, platform: process.platform, arch: process.arch },
    evidence,
    missingEvidence: [
      ...new Set([...projection.missingEvidence, ...(detailed?.missingEvidence ?? [])]),
    ],
    trace: { id: traceId },
    externalReview: externalReview(evidence),
  };
  return report;
}

export function renderReportMarkdown(report: FeedbackReport): string {
  const lines = [
    `# Lorelum ${report.kind} feedback draft`,
    "",
    "> Local draft only. This file has not been submitted, uploaded, or triaged.",
    "",
    "## Summary",
    "",
    report.summary,
    "",
    "## Observed",
    "",
    report.observed,
  ];
  if (report.expected !== undefined) lines.push("", "## Expected", "", report.expected);
  if (report.reproduction !== undefined) {
    lines.push(
      "",
      "## Reproduction",
      "",
      ...report.reproduction.map((step, index) => `${index + 1}. ${step}`),
    );
  }
  lines.push(
    "",
    "## Local context",
    "",
    `- CLI: ${report.context.cliVersion}`,
    `- Platform: ${report.context.platform}`,
    `- Architecture: ${report.context.arch}`,
  );
  if (report.trace !== undefined) lines.push(`- Trace: \`${report.trace.id}\``);
  lines.push("", "## Evidence", "");
  if (report.evidence.length === 0)
    lines.push("No readable local evidence was available for this draft.");
  for (const item of report.evidence) {
    if (item.type === "diagnostic-facts") {
      lines.push("### Diagnostic facts", "", "```json", JSON.stringify(item.facts, null, 2), "```");
    } else if (item.type === "detailed-logs") {
      lines.push(
        `### Detailed ${item.level} logs`,
        "",
        "```json",
        JSON.stringify(item.records, null, 2),
        "```",
      );
    } else {
      lines.push(`### ${item.type}`, "", "```text", item.text, "```");
    }
  }
  lines.push("", "## Evidence limits", "");
  if (report.missingEvidence.length === 0) lines.push("No known local evidence limit.");
  else lines.push(...report.missingEvidence.map((value) => `- ${value}`));
  lines.push("", "## If you choose to share outside this machine", "");
  lines.push("This draft is local only. Any upload or Issue action needs your explicit approval.");
  if (report.externalReview.selectedRawFields.length > 0) {
    lines.push(
      "This local draft includes these detailed evidence classes:",
      ...report.externalReview.selectedRawFields.map((field) => `- ${field}`),
    );
  }
  if (report.externalReview.credentialSignals.length > 0) {
    lines.push(
      "",
      "Potential credential-like text requires review:",
      ...report.externalReview.credentialSignals.map((signal) => `- ${signal}`),
    );
  } else {
    lines.push("No credential-like text was detected in the selected local evidence.");
  }
  if (report.suggestedDisposition !== undefined) {
    lines.push(
      "",
      "## Suggested disposition",
      "",
      `Suggested only: \`${report.suggestedDisposition}\`. A draft does not authorize a Pack, Core, Skill, docs, or evaluation change.`,
    );
  }
  return `${lines.join("\n")}\n`;
}
