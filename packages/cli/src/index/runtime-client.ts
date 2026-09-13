import {
  createBackendRuntimeCoordinator,
  createIndexRuntimeClient,
} from "@lorelum/backend/coordination";

import { createProcessBackendSupervisor } from "../backend/control-commands";
import { createRuntimeProgressReporter } from "../backend/runtime-progress";
import { createProcessBackendClient } from "../model/commands";
import type { OutputWriter } from "../output/protocol";

/** CLI supplies stderr presentation; Backend coordination owns operation observation semantics. */
export async function createProcessIndexRuntimeClient(writer: OutputWriter = process.stderr) {
  const coordinator = createBackendRuntimeCoordinator({
    connect: createProcessBackendClient,
    start: async () => (await createProcessBackendSupervisor()).start(),
  });
  return createIndexRuntimeClient(coordinator, {
    onProgress: createRuntimeProgressReporter(writer),
  });
}
