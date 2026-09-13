import type { MutationResultBase } from "@lorelum/engine";

import type { JsonSchema } from "../output/protocol.js";

export const stringSchema: JsonSchema = { type: "string" };

const stringArraySchema: JsonSchema = { type: "array", items: stringSchema };

const deltaSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["added", "changed", "invalidated"],
  properties: {
    added: stringArraySchema,
    changed: stringArraySchema,
    invalidated: stringArraySchema,
  },
};

const diagnosticSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["level", "code", "path", "message"],
  properties: {
    level: { enum: ["error", "warning", "info"] },
    code: stringSchema,
    path: stringSchema,
    message: stringSchema,
  },
};

export const mutationResultRequired = [
  "generation",
  "effectiveRevision",
  "delta",
  "diagnostics",
  "cleanupPending",
] as const;

export const mutationResultProperties: Readonly<Record<string, JsonSchema>> = {
  generation: { type: "integer" },
  effectiveRevision: { type: "integer" },
  delta: deltaSchema,
  diagnostics: { type: "array", items: diagnosticSchema },
  cleanupPending: { type: "boolean" },
};

export const mutationResultSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: mutationResultRequired,
  properties: mutationResultProperties,
};

export interface MutationResultData {
  readonly generation: number;
  readonly effectiveRevision: number;
  readonly delta: {
    readonly added: readonly string[];
    readonly changed: readonly string[];
    readonly invalidated: readonly string[];
  };
  readonly diagnostics: readonly {
    readonly level: string;
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
  readonly cleanupPending: boolean;
}

/** Map Engine mutation results to the stable CLI JSON representation. */
export function toMutationResultData(result: MutationResultBase): MutationResultData {
  return {
    generation: result.generation,
    effectiveRevision: result.effectiveRevision,
    delta: {
      added: [...result.delta.added],
      changed: [...result.delta.changed],
      invalidated: [...result.delta.invalidated],
    },
    diagnostics: result.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    cleanupPending: result.cleanupPending,
  };
}
