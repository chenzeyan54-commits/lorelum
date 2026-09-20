import type { LogLevel, LogRecord, TraceId } from "@lorelum/log";

export const feedbackKinds = ["bug", "improvement"] as const;
export type FeedbackKind = (typeof feedbackKinds)[number];

export const feedbackDispositions = ["pack", "core", "skill", "docs", "eval", "defer"] as const;
export type FeedbackDisposition = (typeof feedbackDispositions)[number];

export type FeedbackEvidence =
  | {
      readonly type: "user-observation";
      readonly source: "input";
      readonly text: string;
    }
  | {
      readonly type:
        | "query"
        | "practice-content"
        | "path"
        | "native-output"
        | "raw-error"
        | "conversation-excerpt";
      readonly source: "input" | "trace";
      readonly text: string;
      readonly traceId?: TraceId;
    }
  | {
      readonly type: "diagnostic-facts";
      readonly source: "summary";
      readonly traceId: TraceId;
      readonly facts: readonly FeedbackDiagnosticFact[];
    }
  | {
      readonly type: "detailed-logs";
      readonly source: "detailed-log";
      readonly traceId: TraceId;
      readonly level: Extract<LogLevel, "info" | "debug">;
      readonly records: readonly LogRecord[];
    };

export interface FeedbackDiagnosticFact {
  readonly event: string;
  readonly time: string;
  readonly requestId?: string;
  readonly operationId?: string;
  readonly preparationId?: string;
  readonly nativeRunId?: string;
  readonly route?: string;
  readonly method?: "GET" | "POST";
  readonly status?: number;
  readonly buildIdentity?: string;
  readonly readiness?: "pending" | "ready" | "failed";
  readonly exitCode?: number;
  readonly signal?: string;
  readonly stdoutBytes?: number;
  readonly stderrBytes?: number;
  readonly durationMs?: number;
  readonly count?: number;
  readonly code?: string;
}

export interface FeedbackExternalReview {
  readonly required: boolean;
  readonly selectedRawFields: readonly string[];
  readonly credentialSignals: readonly string[];
}

export interface FeedbackReport {
  readonly schemaVersion: 2;
  readonly kind: FeedbackKind;
  readonly summary: string;
  readonly observed: string;
  readonly expected?: string;
  readonly reproduction?: readonly string[];
  readonly context: {
    readonly cliVersion: string;
    readonly platform: string;
    readonly arch: string;
  };
  readonly evidence: readonly FeedbackEvidence[];
  readonly missingEvidence: readonly string[];
  readonly trace?: { readonly id: TraceId };
  readonly externalReview: FeedbackExternalReview;
  readonly suggestedDisposition?: FeedbackDisposition;
}

export interface FeedbackDraftInput {
  readonly schemaVersion: 2;
  readonly kind: FeedbackKind;
  readonly summary: string;
  readonly observed: string;
  readonly expected?: string;
  readonly reproduction?: readonly string[];
  readonly selected?: {
    readonly query?: string;
    readonly practiceContent?: string;
    readonly paths?: readonly string[];
    readonly nativeOutput?: string;
    readonly rawError?: string;
    readonly conversationExcerpt?: string;
  };
  readonly suggestedDisposition?: FeedbackDisposition;
}

export interface FeedbackDraftResult {
  readonly state: "draft";
  readonly reportPath: string;
  readonly markdownPath: string;
  readonly summary: string;
  readonly externalReview: FeedbackExternalReview;
  readonly missingEvidence: readonly string[];
}
