import { expect, test } from "bun:test";
import { join } from "node:path";

import { defaultFeedbackDirectory, defaultLogDirectory, resolveLorelumPaths } from "./lorelum";

test("resolves feedback artifacts below the user-scoped Lorelum root", () => {
  const homeDirectory = "/tmp/lorelum-home";
  expect(defaultFeedbackDirectory(homeDirectory)).toBe(join(homeDirectory, ".lorelum", "feedback"));
  expect(defaultLogDirectory(homeDirectory)).toBe(join(homeDirectory, ".lorelum", "logs"));
  expect(resolveLorelumPaths(homeDirectory).rootDirectory).toBe(join(homeDirectory, ".lorelum"));
});
