import { expect, test } from "bun:test";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { JsonlFileSink } from "./jsonl.js";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "lorelum-jsonl-sink-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("creates a private process-owned segment and keeps concurrent records whole", async () =>
  fixture(async (root) => {
    const path = join(root, "logs", "cli", "2026-09-18", "trace.jsonl");
    const sink = new JsonlFileSink(path, join(root, "logs"));
    await Promise.all(
      Array.from({ length: 8 }, (_, sequence) =>
        sink.write({ level: "info", source: "cli", message: `event-${sequence}` }),
      ),
    );
    await sink.close();
    const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
    expect(lines).toHaveLength(8);
    expect(lines.map((line) => JSON.parse(line).message).sort()).toEqual(
      Array.from({ length: 8 }, (_, sequence) => `event-${sequence}`),
    );
    if (process.platform !== "win32") {
      expect((await lstat(dirname(path))).mode & 0o077).toBe(0);
      expect((await lstat(path)).mode & 0o077).toBe(0);
    }
  }));

test.skipIf(process.platform === "win32")(
  "disables itself rather than following a replaced managed directory",
  async () =>
    fixture(async (root) => {
      const redirected = join(root, "redirected");
      const path = join(root, "logs", "cli", "trace.jsonl");
      const sink = new JsonlFileSink(path, join(root, "logs"));
      await sink.write({ level: "info", source: "cli", message: "before" });
      await writeFile(redirected, "preserve me", "utf8");
      await rm(join(root, "logs", "cli"), { recursive: true });
      await symlink(redirected, join(root, "logs", "cli"));

      await expect(
        sink.write({ level: "info", source: "cli", message: "after" }),
      ).resolves.toBeUndefined();
      await sink.close();
      expect(await readFile(redirected, "utf8")).toBe("preserve me");
    }),
);

test.skipIf(process.platform === "win32")(
  "does not create a managed root below a symlinked Lorelum directory",
  async () =>
    fixture(async (root) => {
      const redirected = join(root, "redirected");
      const logRoot = join(root, "logs");
      await writeFile(redirected, "preserve me", "utf8");
      await symlink(redirected, logRoot);
      const sink = new JsonlFileSink(join(logRoot, "cli", "trace.jsonl"), logRoot, root);

      await expect(
        sink.write({ level: "info", source: "cli", message: "blocked" }),
      ).resolves.toBeUndefined();
      expect(await readFile(redirected, "utf8")).toBe("preserve me");
    }),
);
