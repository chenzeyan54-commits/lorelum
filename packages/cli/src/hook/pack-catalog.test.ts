import { describe, expect, test } from "bun:test";

import { DEFAULT_MAX_CHARACTERS, renderPackCatalog } from "./pack-catalog.js";

describe("renderPackCatalog", () => {
  test("sorts, deduplicates, and normalizes summaries", () => {
    const output = renderPackCatalog([
      {
        name: "react-fullstack",
        version: "0.1.0",
        appliesTo: ["react", "typescript"],
        description: "React\nengineering   practices.",
      },
      {
        name: "agentic-coding",
        version: "0.2.0",
        appliesTo: ["agentic-coding"],
      },
      {
        name: "react-fullstack",
        version: "9.9.9",
        appliesTo: [],
      },
    ]);

    expect(output).toContain("Lorelum Installed Pack Catalog");
    expect(output.indexOf("agentic-coding")).toBeLessThan(output.indexOf("react-fullstack"));
    expect(output).toContain("Stack scope: react, typescript");
    expect(output).toContain("Description: React engineering practices.");
    expect(output).not.toContain("9.9.9");
    expect(output.length).toBeLessThanOrEqual(DEFAULT_MAX_CHARACTERS);
  });

  test("renders an explicit empty state", () => {
    expect(renderPackCatalog([])).toContain(
      "No installed Knowledge Packs are currently available.",
    );
  });

  test("honors the context budget", () => {
    const output = renderPackCatalog(
      [{ name: "frontend", version: "0.1.0", appliesTo: [], description: "x".repeat(500) }],
      { maxCharacters: 128 },
    );

    expect(output.length).toBeLessThanOrEqual(128);
  });

  test("keeps routing guidance when catalog entries are truncated", () => {
    const output = renderPackCatalog(
      [{ name: "frontend", version: "0.1.0", appliesTo: [], description: "x".repeat(2_000) }],
      { maxCharacters: 512 },
    );

    expect(output.length).toBeLessThanOrEqual(512);
    expect(output).toContain("Catalog entries truncated.");
    expect(output).toContain("lore pack list --details");
  });
});
