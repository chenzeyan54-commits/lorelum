import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acquireMutationLock } from "../storage/mutation-lock";

import { withStoreMutation } from "./mutation";

test("database-open failure always releases the acquired mutation lock", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "lorelum-mutation-open-failure-"));
  try {
    await expect(
      withStoreMutation(rootPath, async () => undefined, {
        openRepository: async () => {
          throw new Error("injected database open failure");
        },
      }),
    ).rejects.toThrow("injected database open failure");

    const next = await acquireMutationLock(rootPath, { waitMs: 50 });
    await next.release();
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
