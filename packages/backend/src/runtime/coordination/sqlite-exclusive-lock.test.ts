import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BackendError } from "../../protocol/errors";

import { sqliteExclusiveLock } from "./sqlite-exclusive-lock";

test("SQLite exclusive lock rejects a concurrent zero-wait owner and releases after completion", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "lorelum-backend-lock-")));
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered: (() => void) | undefined;
  const acquired = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    const first = sqliteExclusiveLock.withLock(directory, 1_000, async () => {
      entered?.();
      await held;
    });
    await acquired;

    await expect(sqliteExclusiveLock.withLock(directory, 0, async () => undefined)).rejects.toMatchObject({
      code: "backend.deadline-exceeded",
    } satisfies Partial<BackendError>);

    release?.();
    await first;
    await expect(sqliteExclusiveLock.withLock(directory, 0, async () => "released")).resolves.toBe(
      "released",
    );
  } finally {
    release?.();
    await rm(directory, { recursive: true, force: true });
  }
});
