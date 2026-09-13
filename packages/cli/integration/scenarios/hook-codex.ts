import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { InstalledPacksFixture } from "../fixtures/installed-packs.js";
import { runProcess } from "../support/process.js";
import { isRecord, parseSingleResponse } from "../support/protocol.js";

/** Verify the raw Codex Hook ABI through the compiled CLI. */
export async function verifyCodexHookScenario(
  compiledBinary: string,
  fixture: InstalledPacksFixture,
  workingDirectory: string,
): Promise<void> {
  const successful = await runCodexHook(compiledBinary, fixture.storageRoot, {
    hook_event_name: "SessionStart",
  });
  assert.equal(successful.exitCode, 0);
  assert.equal(successful.stderr, "");
  const response = parseSingleResponse(successful.stdout);
  assert(isRecord(response.hookSpecificOutput));
  assert.equal(response.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(String(response.hookSpecificOutput.additionalContext), /integration-pack/);
  assert.match(
    String(response.hookSpecificOutput.additionalContext),
    /Process integration fixture/,
  );
  assert.equal("protocolVersion" in response, false);
  assert.equal("command" in response, false);

  const malformed = await runCodexHook(compiledBinary, fixture.storageRoot, "{");
  assert.equal(malformed.exitCode, 0);
  assert.equal(malformed.stdout, '{"continue":true}\n');
  assert.match(malformed.stderr, /^lore hook codex degraded: /);

  const unsupported = await runCodexHook(compiledBinary, fixture.storageRoot, {
    hook_event_name: "PostCompact",
  });
  assert.equal(unsupported.exitCode, 0);
  assert.equal(unsupported.stdout, '{"continue":true}\n');
  assert.match(unsupported.stderr, /unsupported event/);

  const unavailableStore = join(workingDirectory, "unavailable-hook-store");
  await writeFile(unavailableStore, "not a directory\n");
  const unavailable = await runCodexHook(compiledBinary, unavailableStore, {
    hook_event_name: "SessionStart",
  });
  assert.equal(unavailable.exitCode, 0);
  assert.equal(unavailable.stdout, '{"continue":true}\n');
  assert.match(unavailable.stderr, /^lore hook codex degraded: /);
}

function runCodexHook(
  binaryPath: string,
  storageRoot: string,
  payload: Record<string, unknown> | string,
) {
  return runProcess(
    [binaryPath, "hook", "codex", "--store-root", storageRoot],
    60_000,
    typeof payload === "string" ? payload : JSON.stringify(payload),
  );
}
