import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface PluginManifest {
  readonly name: string;
}

interface MarketplaceEntry {
  readonly name: string;
  readonly source: {
    readonly source: string;
    readonly path: string;
  };
  readonly policy: {
    readonly installation: string;
    readonly authentication: string;
  };
  readonly category: string;
}

interface MarketplaceConfig {
  readonly name: string;
  readonly plugins: readonly MarketplaceEntry[];
}

test("public marketplace exposes the lorelum Plugin from its matching root", async () => {
  const [manifest, marketplace] = await Promise.all([
    readFile(join(import.meta.dir, "../.codex-plugin/plugin.json"), "utf8").then(
      (content) => JSON.parse(content) as PluginManifest,
    ),
    readFile(join(import.meta.dir, "../../../.agents/plugins/marketplace.json"), "utf8").then(
      (content) => JSON.parse(content) as MarketplaceConfig,
    ),
  ]);

  expect(manifest.name).toBe("lorelum");
  expect(marketplace.name).toBe("lorelum");
  expect(marketplace.plugins).toEqual([
    {
      name: "lorelum",
      source: { source: "local", path: "./plugins/lorelum" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Productivity",
    },
  ]);
});
