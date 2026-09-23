import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDescriptorRepository, removeDescriptorRepository } from "./git-test-support.js";
import { loadLocalRegistry } from "./local-registry.js";

const validRegistry = `schema_version: 1
name: local-team
packs: []
`;

test("loads a descriptor from the current HEAD of a local Git worktree", async () => {
  const fixture = await createDescriptorRepository(validRegistry);
  try {
    const loaded = await loadLocalRegistry(fixture.path);
    expect(loaded.registry.name).toBe("local-team");
    expect(loaded.repository.worktree).toBe(await realpath(fixture.path));
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("rejects a non-worktree local Registry path without exposing it", async () => {
  const path = await mkdtemp(join(tmpdir(), "lorelum-local-registry-"));
  try {
    await expect(loadLocalRegistry(path)).rejects.toMatchObject({ code: "registry.unavailable" });
  } finally {
    await rm(path, { force: true, recursive: true });
  }
});
