import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigError, DEFAULT_LOGGING_SETTINGS, loadLoggingSettings } from "./index.js";

test("uses info logging by default and reads the consumer-owned logging section", async () => {
  const home = await mkdtemp(join(tmpdir(), "lorelum-logging-settings-"));
  try {
    expect(await loadLoggingSettings({ homeDirectory: home })).toEqual(DEFAULT_LOGGING_SETTINGS);
    await mkdir(join(home, ".lorelum"));
    await writeFile(join(home, ".lorelum", "config.yaml"), "logging:\n  level: debug\n");
    await expect(loadLoggingSettings({ homeDirectory: home })).resolves.toEqual({ level: "debug" });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("rejects an invalid logging level", async () => {
  const home = await mkdtemp(join(tmpdir(), "lorelum-logging-settings-"));
  try {
    await mkdir(join(home, ".lorelum"));
    await writeFile(join(home, ".lorelum", "config.yaml"), "logging:\n  level: noisy\n");
    await expect(loadLoggingSettings({ homeDirectory: home })).rejects.toEqual(new ConfigError());
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
