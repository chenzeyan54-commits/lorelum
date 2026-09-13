import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("restores the Pack Catalog through SessionStart after compaction", async () => {
  const configuration = JSON.parse(
    await readFile(join(import.meta.dir, "../hooks/hooks.json"), "utf8"),
  ) as {
    readonly hooks: {
      readonly SessionStart?: readonly {
        readonly matcher: string;
        readonly hooks: readonly { readonly additionalContextLimit?: number }[];
      }[];
      readonly PostCompact?: unknown;
    };
  };

  expect(configuration.hooks.SessionStart).toEqual([
    {
      matcher: "^(startup|resume|clear|compact)$",
      hooks: [expect.objectContaining({ additionalContextLimit: 5_000 })],
    },
  ]);
  expect(configuration.hooks.PostCompact).toBeUndefined();
});
