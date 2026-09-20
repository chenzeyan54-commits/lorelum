import { createIndexRuntimeClient } from "@lorelum/backend/coordination";

import { createProcessBackendRuntimeCoordinator } from "../backend/process-runtime-coordinator";
import { createRuntimeProgressReporter } from "../backend/runtime-progress";
import type { OutputWriter } from "../output/protocol";
import type { TraceId } from "@lorelum/log";

/** CLI supplies stderr presentation; Backend coordination owns operation observation semantics. */
export async function createProcessIndexRuntimeClient(
  traceId?: TraceId,
  debug = false,
  writer: OutputWriter = process.stderr,
) {
  const coordinator = createProcessBackendRuntimeCoordinator(traceId, debug);
  return createIndexRuntimeClient(coordinator, {
    onProgress: createRuntimeProgressReporter(writer),
  });
}
