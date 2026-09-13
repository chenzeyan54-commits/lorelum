import { expect, test } from "bun:test";
import { resolveContentLink } from "./resolve-content-link";

test("links from the index remain inside the localized docs", () => {
  expect(resolveContentLink("./quickstart", "index.mdx", "en")).toBe("/en/docs/quickstart");
  expect(resolveContentLink("./agents.md", "agents.zh.mdx", "zh")).toBe("/zh/docs/agents.md");
});

test("nested reference links resolve from the content folder", () => {
  expect(resolveContentLink("./get", "reference/query.mdx", "en")).toBe("/en/docs/reference/get");
  expect(resolveContentLink("../cli#json-protocol", "reference/query.mdx", "zh")).toBe(
    "/zh/docs/cli#json-protocol",
  );
  expect(resolveContentLink("#results", "reference/query.mdx", "en")).toBe("#results");
  expect(resolveContentLink("https://example.com", "index.mdx", "en")).toBe("https://example.com");
});
