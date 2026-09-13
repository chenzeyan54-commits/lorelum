import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildHookResponse,
  createHookResponse,
  createCliPackSummarySource,
  parsePackSummaryEnvelope,
} from "./inject-pack-index";
import type { PackSummarySource } from "./types";

describe("inject-pack-index", () => {
  test("parses the metadata envelope", () => {
    expect(
      parsePackSummaryEnvelope({
        ok: true,
        data: {
          packs: [{ name: "react-fullstack", version: "0.1.0", appliesTo: ["react"] }],
        },
      }),
    ).toEqual([{ name: "react-fullstack", version: "0.1.0", appliesTo: ["react"] }]);
  });

  test("rejects an invalid envelope", () => {
    expect(() => parsePackSummaryEnvelope({ ok: false })).toThrow();
    expect(() =>
      parsePackSummaryEnvelope({
        ok: true,
        data: { packs: [{ name: "react", version: "1.0.0" }] },
      }),
    ).toThrow();
    expect(() =>
      parsePackSummaryEnvelope({
        ok: true,
        data: { packs: [{ name: "react", version: "1.0.0", appliesTo: ["react", 42] }] },
      }),
    ).toThrow();
  });

  test("emits additional context for SessionStart", async () => {
    const source: PackSummarySource = {
      async readInstalledPackSummaries() {
        return [{ name: "agentic-coding", version: "0.1.0", appliesTo: [] }];
      },
    };

    const response = await createHookResponse({ hook_event_name: "SessionStart" }, source);
    expect(response.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(response.hookSpecificOutput?.additionalContext).toContain("agentic-coding");
    expect(response).toEqual(buildHookResponse("SessionStart", expect.any(String)));
  });

  test("rejects an unsupported lifecycle event", async () => {
    const source: PackSummarySource = {
      async readInstalledPackSummaries() {
        return [];
      },
    };

    await expect(createHookResponse({ hook_event_name: "PostCompact" }, source)).rejects.toThrow(
      "unsupported event",
    );
  });

  test("times out a CLI process before the hook deadline", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "lorelum-plugin-timeout-"));
    const sleeperPath = join(rootPath, "sleep.ts");
    await writeFile(sleeperPath, "await Bun.sleep(10_000);", "utf8");

    try {
      const source = createCliPackSummarySource({
        command: process.execPath,
        args: [sleeperPath],
        timeoutMs: 50,
      });
      await expect(source.readInstalledPackSummaries()).rejects.toThrow(
        "Lorelum metadata command failed with exit code",
      );
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });

  test("runs the hook entrypoint with default lore pack list details arguments", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "lorelum-plugin-hook-"));
    const fakeCommandPath = join(rootPath, "pack");
    const hookPath = join(import.meta.dir, "inject-pack-index.ts");
    await writeFile(
      fakeCommandPath,
      [
        "const args = process.argv.slice(2);",
        'if (JSON.stringify(args) !== JSON.stringify(["list", "--details"])) {',
        "  process.stderr.write(`unexpected arguments: ${JSON.stringify(args)}`);",
        "  process.exitCode = 1;",
        "} else {",
        '  process.stdout.write(JSON.stringify({ ok: true, data: { packs: [{ name: "react", version: "1.0.0", description: "React engineering practices.", appliesTo: ["frontend"] }] } }));',
        "}",
      ].join("\n"),
      "utf8",
    );

    try {
      const { LORELUM_CLI_ARGS: _ignoredCliArgs, ...environment } = process.env;
      const child = Bun.spawn([process.execPath, hookPath], {
        env: {
          ...environment,
          LORELUM_CLI_COMMAND: process.execPath,
        },
        cwd: rootPath,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.write(JSON.stringify({ hook_event_name: "SessionStart" }));
      child.stdin.end();
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(JSON.parse(stdout)).toEqual({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: expect.stringContaining("React engineering practices."),
        },
      });
    } finally {
      await rm(rootPath, { recursive: true, force: true });
    }
  });
});
