import { describe, expect, test } from "bun:test";

import { parseResourceLinks, validateResourceLinks, validateResourcePath } from "./resources";

describe("parseResourceLinks", () => {
  test("finds resource links in ordinary Markdown", () => {
    expect(parseResourceLinks("Read [the matrix](resource:references/api.md).\n")).toEqual([
      {
        path: "references/api.md",
        target: "resource:references/api.md",
        line: 1,
        column: 6,
      },
    ]);
  });

  test("does not parse normal URLs, relative links, inline code, or fenced code", () => {
    const markdown = [
      "[web](https://example.com/resource:references/api.md)",
      "[local](references/api.md)",
      "`[inline](resource:references/inline.md)`",
      "",
      "```md",
      "[fenced](resource:references/fenced.md)",
      "```",
      "",
      "~~~text",
      "[tilde](resource:assets/tilde.txt)",
      "~~~",
      "",
      "    [indented](resource:references/indented.md)",
    ].join("\n");
    expect(parseResourceLinks(markdown)).toEqual([]);
  });

  test("supports angle-bracket targets", () => {
    expect(parseResourceLinks("[guide](<resource:references/guide with spaces.md>)")).toHaveLength(
      1,
    );
    expect(parseResourceLinks("[guide](<resource:references/guide with spaces.md>)")[0]?.path).toBe(
      "references/guide with spaces.md",
    );
  });

  test("keeps source locations correct after non-BMP text", () => {
    expect(parseResourceLinks("😀 [guide](resource:references/guide.md)")[0]?.column).toBe(4);
  });
});

describe("validateResourcePath", () => {
  test("accepts each resource root", () => {
    expect(validateResourcePath("references/a.md").valid).toBe(true);
    expect(validateResourcePath("assets/report.docx").valid).toBe(true);
    expect(validateResourcePath("scripts/check/main.py").valid).toBe(true);
  });

  test("rejects traversal, query/fragment, and non-resource roots", () => {
    for (const path of [
      "../secrets.txt",
      "references/../secrets.txt",
      "references/a.md?raw=1",
      "references/a.md#section",
      "docs/a.md",
      "/references/a.md",
      "scripts\\check.py",
      "scripts//check.py",
      "references/a*.md",
      "references/a<.md",
      "references/a>.md",
      'references/a".md',
      "references/a|.md",
      "references/clock$.md",
    ]) {
      expect(validateResourcePath(path).valid, path).toBe(false);
    }
  });
});

describe("validateResourceLinks", () => {
  test("reports invalid and missing targets with source location", () => {
    const issues = validateResourceLinks(
      [
        "# Heading",
        "[bad](resource:../secret.txt)",
        "[missing](resource:references/missing.md)",
      ].join("\n"),
      {
        sourcePath: "practices/api/review.md",
        availablePaths: new Set(["references/present.md"]),
      },
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      "resource-target-invalid",
      "resource-target-missing",
    ]);
    expect(issues[0]?.path).toBe("practices/api/review.md:2:1");
    expect(issues[1]?.path).toBe("practices/api/review.md:3:1");
  });

  test("allows unlinked files and valid linked targets", () => {
    expect(
      validateResourceLinks("[check](resource:scripts/check/main.py)", {
        availablePaths: new Set(["scripts/check/main.py", "scripts/check/helpers.py"]),
      }),
    ).toEqual([]);
  });
});
