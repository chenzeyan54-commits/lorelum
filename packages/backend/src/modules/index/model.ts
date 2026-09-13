import { isAbsolute } from "node:path";
import { z } from "zod";

import { embeddingErrorCodes } from "../embedding/errors";

// The store root must be explicit and absolute; the separator convention is the host's
// (mirrors query/model.ts — Windows drive roots are not slash-prefixed).
const storageRootSchema = z
  .string()
  .min(1)
  .refine(isAbsolute, "storageRoot must be an absolute path");
const profileIdSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const indexStateSchema = z.enum(["missing", "ready", "stale", "incompatible"]);
export const indexStatusSchema = z.strictObject({
  state: indexStateSchema,
  profileId: profileIdSchema,
  vectorCount: z.int().nonnegative().optional(),
});
export type IndexStatus = z.infer<typeof indexStatusSchema>;

export const indexStatusQuerySchema = z.strictObject({ storageRoot: storageRootSchema });
export const indexMutationSchema = z.strictObject({ storageRoot: storageRootSchema });
export const indexOperationStateSchema = z.enum(["building", "preparing", "ready", "failed"]);
export const indexOperationStoreErrorCodes = ["store.busy", "store.recovery-required"] as const;
export const indexOperationErrorCodes = [
  "backend.failed",
  ...embeddingErrorCodes,
  ...indexOperationStoreErrorCodes,
] as const;
export type IndexOperationErrorCode = (typeof indexOperationErrorCodes)[number];
const indexOperationIdSchema = z.string().uuid();
export const indexOperationSchema = z.discriminatedUnion("state", [
  z.strictObject({
    operationId: indexOperationIdSchema,
    state: z.literal("building"),
  }),
  z.strictObject({
    operationId: indexOperationIdSchema,
    state: z.literal("preparing"),
    preparationId: z.string().uuid(),
  }),
  z.strictObject({
    operationId: indexOperationIdSchema,
    state: z.literal("ready"),
    index: indexStatusSchema,
  }),
  z.strictObject({
    operationId: indexOperationIdSchema,
    state: z.literal("failed"),
    error: z.enum(indexOperationErrorCodes),
  }),
]);
export type IndexOperation = z.infer<typeof indexOperationSchema>;
export const indexOperationParamsSchema = z.strictObject({ operationId: z.string().uuid() });
