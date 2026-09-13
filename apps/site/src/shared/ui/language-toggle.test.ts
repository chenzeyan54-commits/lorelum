import { expect, test } from "bun:test";
import { languageSwitchPath } from "./language-toggle";

test("switches landing and docs paths without losing the current page", () => {
  expect(languageSwitchPath("/", "en")).toBe("/zh");
  expect(languageSwitchPath("/zh", "zh")).toBe("/");
  expect(languageSwitchPath("/en/docs/quickstart", "en")).toBe("/zh/docs/quickstart");
  expect(languageSwitchPath("/zh/docs/quickstart", "zh")).toBe("/en/docs/quickstart");
});
