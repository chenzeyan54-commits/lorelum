import type { RuntimeProgress } from "@lorelum/backend/coordination";

import type { OutputWriter } from "../output/protocol";

/** CLI owns terminal presentation; closed stderr must not cancel shared runtime work. */
export function createRuntimeProgressReporter(writer: OutputWriter) {
  const seen = new Set<RuntimeProgress>();
  return (progress: RuntimeProgress) => {
    if (seen.has(progress)) return;
    seen.add(progress);
    try {
      writer.write(`${progress}\n`);
    } catch {
      /* Closed stderr must not cancel shared preparation. */
    }
  };
}
