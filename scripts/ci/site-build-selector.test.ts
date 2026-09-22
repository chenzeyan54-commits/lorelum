import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  pullRequestBaseSha,
  selectSiteBuild,
  selectSiteBuildFromNameStatus,
} from "./site-build-selector";

function nameStatus(...fields: readonly string[]): Uint8Array {
  return new TextEncoder().encode(`${fields.join("\0")}\0`);
}

function git(cwd: string, gitArguments: readonly string[]): string {
  const result = Bun.spawnSync(["git", ...gitArguments], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  return new TextDecoder().decode(result.stdout).trim();
}

test("predicts a skip only for added or modified non-UI package paths", () => {
  expect(
    selectSiteBuildFromNameStatus(
      nameStatus("M", "packages/engine/src/query.ts", "A", "packages/cli/src/command.ts"),
    ),
  ).toEqual({ siteBuild: "skip", reason: "core-package-only" });
});

test("keeps the site build for UI, site, root, delete, and rename changes", () => {
  for (const output of [
    nameStatus("M", "packages/ui/src/button.tsx"),
    nameStatus("M", "apps/site/src/routes.tsx"),
    nameStatus("M", "package.json"),
    nameStatus("D", "packages/engine/src/query.ts"),
    nameStatus("R100", "packages/engine/src/old.ts", "packages/engine/src/new.ts"),
  ]) {
    expect(selectSiteBuildFromNameStatus(output)).toEqual({
      siteBuild: "run",
      reason: "site-relevant-or-unknown",
    });
  }
});

test("fails closed for empty, malformed, and non-UTF-8 name-status output", () => {
  expect(selectSiteBuildFromNameStatus(new Uint8Array())).toEqual({
    siteBuild: "run",
    reason: "empty-diff",
  });
  expect(
    selectSiteBuildFromNameStatus(new TextEncoder().encode("M\0packages/engine/src/query.ts")),
  ).toEqual({
    siteBuild: "run",
    reason: "invalid-name-status",
  });
  expect(selectSiteBuildFromNameStatus(new Uint8Array([0xff]))).toEqual({
    siteBuild: "run",
    reason: "invalid-name-status",
  });
});

test("accepts only a pull-request base SHA", () => {
  const sha = "a".repeat(40);
  expect(pullRequestBaseSha({ pull_request: { base: { sha } } })).toBe(sha);
  expect(pullRequestBaseSha({ pull_request: { base: { sha: "not-a-sha" } } })).toBeUndefined();
});

test("fetches a missing base once, then uses the retry result", async () => {
  const sha = "b".repeat(40);
  const calls: readonly string[][] = [];
  let invocation = 0;
  const decision = await selectSiteBuild({
    eventName: "pull_request",
    eventPath: "/event.json",
    readEvent: async () => JSON.stringify({ pull_request: { base: { sha } } }),
    runGit: (gitArguments) => {
      (calls as string[][]).push([...gitArguments]);
      invocation += 1;
      if (invocation === 1) return { exitCode: 1, stdout: new Uint8Array() };
      if (invocation === 2) return { exitCode: 0, stdout: new Uint8Array() };
      return { exitCode: 0, stdout: nameStatus("M", "packages/engine/src/query.ts") };
    },
  });

  expect(decision).toEqual({ siteBuild: "skip", reason: "core-package-only" });
  expect(calls).toEqual([
    ["diff", "--name-status", "-z", sha, "HEAD"],
    ["fetch", "--no-tags", "--depth=1", "origin", sha],
    ["diff", "--name-status", "-z", sha, "HEAD"],
  ]);
});

test("fails closed when the event cannot be read or the base cannot be fetched", async () => {
  await expect(
    selectSiteBuild({
      eventName: "pull_request",
      eventPath: "/event.json",
      readEvent: async () => {
        throw new Error("missing event");
      },
    }),
  ).resolves.toEqual({ siteBuild: "run", reason: "invalid-event" });

  const sha = "c".repeat(40);
  await expect(
    selectSiteBuild({
      eventName: "pull_request",
      eventPath: "/event.json",
      readEvent: async () => JSON.stringify({ pull_request: { base: { sha } } }),
      runGit: () => ({ exitCode: 1, stdout: new Uint8Array() }),
    }),
  ).resolves.toEqual({ siteBuild: "run", reason: "base-unavailable" });
});

test("uses the actual Git snapshot when classifying a pull request", async () => {
  const root = await mkdtemp(join(tmpdir(), "lorelum-site-build-selector-"));
  try {
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "ci@example.invalid"]);
    git(root, ["config", "user.name", "CI Selector Test"]);
    await mkdir(join(root, "packages", "engine", "src"), { recursive: true });
    await writeFile(
      join(root, "packages", "engine", "src", "query.ts"),
      "export const query = 1;\n",
    );
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "base"]);
    const sha = git(root, ["rev-parse", "HEAD"]);
    await writeFile(
      join(root, "packages", "engine", "src", "query.ts"),
      "export const query = 2;\n",
    );
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "change"]);

    await expect(
      selectSiteBuild({
        cwd: root,
        eventName: "pull_request",
        eventPath: "/event.json",
        readEvent: async () => JSON.stringify({ pull_request: { base: { sha } } }),
      }),
    ).resolves.toEqual({ siteBuild: "skip", reason: "core-package-only" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CI keeps verify and site build unconditional while selection is report-only", async () => {
  const workflow = await Bun.file(
    new URL("../../.github/workflows/ci.yml", import.meta.url),
  ).text();

  expect(workflow).toContain("name: verify");
  expect(workflow).toContain("Classify site build scope (report only)");
  expect(workflow).toContain("run: bun run build:site");
  expect(workflow).not.toMatch(/^\s*paths:/m);
});
