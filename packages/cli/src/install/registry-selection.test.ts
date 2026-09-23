import { expect, test } from "bun:test";
import { RegistryCatalogBusyError, RegistryCatalogError } from "@lorelum/config";

import { selectRegistry } from "./registry-selection.js";

test("uses the implicit official source when the saved catalog has no default", async () => {
  await expect(selectRegistry(undefined, async () => ({ registries: {} }))).resolves.toEqual({
    kind: "remote",
    alias: "official",
  });
});

test("selects an explicit alias and lets it override the saved default", async () => {
  const catalog = async () => ({
    defaultAlias: "team",
    registries: {
      team: { kind: "remote-git" as const, locator: "https://git.example.com/team/packs.git" },
      local: { kind: "local-git" as const, worktree: "/private/team-packs" },
    },
  });
  await expect(selectRegistry("local", catalog)).resolves.toEqual({
    kind: "local",
    alias: "local",
    worktree: "/private/team-packs",
  });
  await expect(selectRegistry(undefined, catalog)).resolves.toEqual({
    kind: "remote",
    alias: "team",
    locator: "https://git.example.com/team/packs.git",
  });
});

test("does not misclassify SCP locators with a single-segment repository as aliases", async () => {
  let catalogReads = 0;
  await expect(
    selectRegistry("git@git.example.com:team-packs.git", async () => {
      catalogReads += 1;
      return { registries: {} };
    }),
  ).resolves.toEqual({ kind: "remote", locator: "git@git.example.com:team-packs.git" });
  expect(catalogReads).toBe(0);
});

test("returns a typed error for an unknown alias without falling back", async () => {
  await expect(selectRegistry("team", async () => ({ registries: {} }))).rejects.toMatchObject({
    code: "registry.alias-not-found",
  });
});

test("maps unreadable or busy catalog state instead of changing the selected source", async () => {
  await expect(
    selectRegistry(undefined, async () => {
      throw new RegistryCatalogError();
    }),
  ).rejects.toMatchObject({ code: "registry.catalog-invalid" });
  await expect(
    selectRegistry("team", async () => {
      throw new RegistryCatalogBusyError();
    }),
  ).rejects.toMatchObject({ code: "registry.catalog-busy" });
});
