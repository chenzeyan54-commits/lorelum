import { expect, test } from "bun:test";

import { createRuntimeProgressReporter } from "./runtime-progress";

test("runtime progress uses injected writer, deduplicates observed stages, and tolerates closed stderr", () => {
  const output: string[] = [];
  const report = createRuntimeProgressReporter({
    write: (value) => {
      output.push(value);
    },
  });
  report("backend: starting");
  report("backend: starting");
  report("index: building");
  report("model: waiting");
  report("model: downloading");
  report("model: verifying");
  report("model: verifying");
  report("model: starting");
  expect(output.join("")).toBe(
    "backend: starting\nindex: building\nmodel: waiting\nmodel: downloading\nmodel: verifying\nmodel: starting\n",
  );
  const closed = createRuntimeProgressReporter({
    write: () => {
      throw new Error("closed stderr");
    },
  });
  expect(() => closed("model: waiting")).not.toThrow();
});
