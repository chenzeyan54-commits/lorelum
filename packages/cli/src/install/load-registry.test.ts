import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDescriptorRepository,
  gitRunnerMappingLocators,
  removeDescriptorRepository,
  runFixtureGit,
} from "./git-test-support.js";
import type { MaterializeGitRunner } from "./materialize-source.js";
import { loadRegistry, resolveRegistryRepository } from "./load-registry.js";

const validRegistry = `schema_version: 1
name: lorelum-official
packs:
  - name: agentic-coding
    releases:
      - version: 0.1.0
        ref: agentic-coding-v0.1.0
        path: packs/agentic-coding
`;

const RAW_UNAVAILABLE_MESSAGE = "The Pack Registry is unavailable.";
const GIT_UNAVAILABLE_MESSAGE =
  "The Pack Registry is unavailable. Verify your SSH access to the repository " +
  "(e.g. `ssh -T git@github.com`), then retry.";
const GENERIC_GIT_UNAVAILABLE_MESSAGE =
  "The Pack Registry is unavailable. Verify non-interactive Git access to the selected " +
  "repository, then retry.";
const SSH_LOCATOR = "git@github.com:acme/team-packs.git";
const SSH_URL_LOCATOR = "ssh://git@github.com/acme/team-packs.git";

function responseFetch(response: Response): typeof fetch {
  return (() => Promise.resolve(response)) as unknown as typeof fetch;
}

function fetchMustNotRun(): typeof fetch {
  return (() => {
    throw new Error("raw descriptor fetch must not run for git transport");
  }) as unknown as typeof fetch;
}

function gitMustNotRun() {
  return () => Promise.reject(new Error("git transport must not run for legacy locators"));
}

test("uses the built-in official Registry repository", () => {
  expect(resolveRegistryRepository()).toEqual({
    slug: "lorelum/lorelum-packs",
    gitUrl: "https://github.com/lorelum/lorelum-packs.git",
    descriptorUrl:
      "https://raw.githubusercontent.com/lorelum/lorelum-packs/HEAD/.lorelum/registry.yaml",
    transport: "raw",
    legacyGithub: true,
  });
});

test("normalizes an explicit GitHub Registry repository", async () => {
  const loaded = await loadRegistry(
    "https://github.com/acme/team-packs.git",
    responseFetch(new Response(validRegistry)),
  );
  expect(loaded.repository.slug).toBe("acme/team-packs");
  expect(loaded.repository.transport).toBe("raw");
  expect(loaded.repository.gitUrl).toBe("https://github.com/acme/team-packs.git");
  expect(loaded.registry.packs[0]?.name).toBe("agentic-coding");
});

test("accepts platform-neutral HTTPS and SSH Git endpoints", () => {
  expect(resolveRegistryRepository("https://gitlab.example.com/team/packs.git")).toMatchObject({
    slug: "https://gitlab.example.com/team/packs.git",
    gitUrl: "https://gitlab.example.com/team/packs.git",
    transport: "git",
    legacyGithub: false,
  });
  expect(
    resolveRegistryRepository("ssh://deploy@git.example.com:2222/group/subgroup/packs.git"),
  ).toMatchObject({
    slug: "ssh://deploy@git.example.com:2222/group/subgroup/packs.git",
    transport: "git",
    legacyGithub: false,
  });
  expect(resolveRegistryRepository("git@git.example.com:team-packs.git")).toMatchObject({
    slug: "git@git.example.com:team-packs.git",
    transport: "git",
    legacyGithub: false,
  });
  expect(resolveRegistryRepository("https://github.com:8443/acme/packs.git")).toMatchObject({
    slug: "https://github.com:8443/acme/packs.git",
    transport: "git",
    legacyGithub: false,
  });
});

test("resolves SSH locators to the user-authenticated git transport", () => {
  const scp = resolveRegistryRepository(SSH_LOCATOR);
  expect(scp.slug).toBe("acme/team-packs");
  expect(scp.gitUrl).toBe(SSH_LOCATOR);
  expect(scp.transport).toBe("git");

  const url = resolveRegistryRepository(SSH_URL_LOCATOR);
  expect(url.slug).toBe("acme/team-packs");
  expect(url.gitUrl).toBe(SSH_URL_LOCATOR);
  expect(url.transport).toBe("git");

  const withoutSuffix = resolveRegistryRepository("git@github.com:acme/team-packs");
  expect(withoutSuffix.slug).toBe("acme/team-packs");
  expect(withoutSuffix.transport).toBe("git");
});

test.each([
  "file:///tmp/packs",
  "http://git.example.com/team/packs.git",
  "git://git.example.com/team/packs.git",
  "ext::echo unsafe",
  "https://git.example.com/.lorelum/registry.yaml",
  "https://git.example.com/.lorelum%2Fregistry.yaml",
  "https://git.example.com/team/../packs.git",
  "ssh://git@git.example.com/team/../packs.git",
  "git@git.example.com:team/../packs.git",
  "https://git.example.com/team/packs.git?token=secret",
  "https://git.example.com/team/packs.git#fragment",
])("rejects unsupported or unsafe generic locator %s before git transport", (locator) => {
  expect(() => resolveRegistryRepository(locator)).toThrow("valid Git repository");
});

test("rejects credentialed locator forms outright", () => {
  expect(() => resolveRegistryRepository("https://git:token@github.com/acme/packs.git")).toThrow(
    "valid Git repository",
  );
  expect(() => resolveRegistryRepository("ssh://git:pass@github.com/acme/packs.git")).toThrow(
    "valid Git repository",
  );
});

test("never retries legacy locators over git transport when raw fails", async () => {
  await expect(
    loadRegistry(
      "acme/team-packs",
      responseFetch(new Response("missing", { status: 404 })),
      gitMustNotRun(),
    ),
  ).rejects.toMatchObject({ code: "registry.unavailable", message: RAW_UNAVAILABLE_MESSAGE });
});

test("rejects dot segments rather than normalizing them into another repository", () => {
  expect(() => resolveRegistryRepository("ssh://git@github.com/acme/../evil/repo.git")).toThrow(
    "valid Git repository",
  );
});

test("accepts case-insensitive github.com hosts in scp-style locators", () => {
  const resolved = resolveRegistryRepository("git@GitHub.com:acme/team-packs.git");
  expect(resolved.slug).toBe("acme/team-packs");
  expect(resolved.gitUrl).toBe("git@GitHub.com:acme/team-packs.git");
  expect(resolved.transport).toBe("git");
});

test("distinguishes invalid content from an unavailable Registry", async () => {
  await expect(
    loadRegistry(undefined, responseFetch(new Response("schema_version: 2", { status: 200 }))),
  ).rejects.toMatchObject({ code: "registry.invalid" });
  await expect(
    loadRegistry(undefined, responseFetch(new Response("missing", { status: 404 }))),
  ).rejects.toMatchObject({
    code: "registry.unavailable",
    message: RAW_UNAVAILABLE_MESSAGE,
  });
});

test("keeps slug locators on the anonymous raw transport", async () => {
  const loaded = await loadRegistry(
    "acme/team-packs",
    responseFetch(new Response(validRegistry)),
    gitMustNotRun(),
  );
  expect(loaded.repository.transport).toBe("raw");
  expect(loaded.registry.packs[0]?.name).toBe("agentic-coding");
});

test("reads the descriptor over git transport from a local repository", async () => {
  const fixture = await createDescriptorRepository(validRegistry);
  try {
    const loaded = await loadRegistry(
      SSH_LOCATOR,
      fetchMustNotRun(),
      gitRunnerMappingLocators({ [SSH_LOCATOR]: fixture.fileUrl }),
    );
    expect(loaded.repository).toMatchObject({ slug: "acme/team-packs", transport: "git" });
    expect(loaded.registry.packs[0]?.name).toBe("agentic-coding");
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("reads ssh:// locators through the same git transport", async () => {
  const fixture = await createDescriptorRepository(validRegistry);
  try {
    const loaded = await loadRegistry(
      SSH_URL_LOCATOR,
      fetchMustNotRun(),
      gitRunnerMappingLocators({ [SSH_URL_LOCATOR]: fixture.fileUrl }),
    );
    expect(loaded.repository.slug).toBe("acme/team-packs");
    expect(loaded.registry.packs[0]?.name).toBe("agentic-coding");
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("reads non-GitHub HTTPS descriptors through the Git transport", async () => {
  const locator = "https://gitlab.example.com/platform/team-packs.git";
  const fixture = await createDescriptorRepository(validRegistry);
  try {
    const loaded = await loadRegistry(
      locator,
      fetchMustNotRun(),
      gitRunnerMappingLocators({ [locator]: fixture.fileUrl }),
    );
    expect(loaded.repository).toMatchObject({ slug: locator, transport: "git" });
    expect(loaded.registry.packs[0]?.name).toBe("agentic-coding");
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("reads a generic descriptor when its Git server ignores the partial-clone filter", async () => {
  const locator = "https://gitlab.example.com/platform/team-packs.git";
  const fixture = await createDescriptorRepository(validRegistry);
  try {
    await runFixtureGit(fixture.path, ["config", "uploadpack.allowFilter", "false"]);
    const loaded = await loadRegistry(
      locator,
      fetchMustNotRun(),
      gitRunnerMappingLocators({ [locator]: fixture.fileUrl }),
    );
    expect(loaded.repository).toMatchObject({ slug: locator, transport: "git" });
    expect(loaded.registry.name).toBe("lorelum-official");
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("bounds the descriptor clone so unrelated blobs are never transferred", async () => {
  const fixture = await createDescriptorRepository(validRegistry, {
    "assets/bulk.bin": "l".repeat(5 * 1024 * 1024),
  });
  try {
    const bulkSha = await runFixtureGit(fixture.path, ["rev-parse", "HEAD:assets/bulk.bin"]);
    const mapping = gitRunnerMappingLocators({ [SSH_LOCATOR]: fixture.fileUrl });
    let cloneArgv: readonly string[] = [];
    let localObjectIds = "";
    const recordingRunner: MaterializeGitRunner = async (arguments_, options) => {
      const output = await mapping(arguments_, options);
      if (arguments_[0] === "clone") {
        cloneArgv = arguments_;
      } else if (arguments_[2] === "show") {
        // The temporary clone still exists during this call: probe its local
        // object store now, before loadRegistry removes it. Enumerating via
        // --batch-all-objects avoids the lazy backfill that `cat-file -e`
        // would trigger for the probed object itself.
        localObjectIds = await runFixtureGit(arguments_[1] ?? "", [
          "cat-file",
          "--batch-all-objects",
          "--batch-check",
        ]);
      }
      return output;
    };
    const loaded = await loadRegistry(SSH_LOCATOR, fetchMustNotRun(), recordingRunner);
    expect(loaded.registry.packs[0]?.name).toBe("agentic-coding");
    expect(cloneArgv).toContain("--filter=tree:0");
    expect(localObjectIds).not.toContain(bulkSha);
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("maps a missing descriptor over git transport to an actionable unavailable error", async () => {
  const fixture = await createDescriptorRepository();
  try {
    await expect(
      loadRegistry(
        SSH_LOCATOR,
        fetchMustNotRun(),
        gitRunnerMappingLocators({ [SSH_LOCATOR]: fixture.fileUrl }),
      ),
    ).rejects.toMatchObject({
      code: "registry.unavailable",
      message: GIT_UNAVAILABLE_MESSAGE,
    });
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("maps an unreachable repository to the same unavailable classification", async () => {
  await expect(
    loadRegistry(
      SSH_LOCATOR,
      fetchMustNotRun(),
      gitRunnerMappingLocators({
        [SSH_LOCATOR]: join(tmpdir(), "lorelum-nonexistent-repository"),
      }),
    ),
  ).rejects.toMatchObject({ code: "registry.unavailable", message: GIT_UNAVAILABLE_MESSAGE });
});

test("keeps generic Git transport remediation separate from legacy GitHub SSH", async () => {
  const locator = "https://gitlab.example.com/platform/team-packs.git";
  await expect(
    loadRegistry(
      locator,
      fetchMustNotRun(),
      gitRunnerMappingLocators({ [locator]: join(tmpdir(), "lorelum-nonexistent-repository") }),
    ),
  ).rejects.toMatchObject({
    code: "registry.unavailable",
    message: GENERIC_GIT_UNAVAILABLE_MESSAGE,
  });
});

test("maps an oversized descriptor over git transport to registry.invalid", async () => {
  const oversized = `# ${"x".repeat(256 * 1024)}\n`;
  const fixture = await createDescriptorRepository(oversized);
  try {
    await expect(
      loadRegistry(
        SSH_LOCATOR,
        fetchMustNotRun(),
        gitRunnerMappingLocators({ [SSH_LOCATOR]: fixture.fileUrl }),
      ),
    ).rejects.toMatchObject({ code: "registry.invalid" });
  } finally {
    await removeDescriptorRepository(fixture);
  }
});

test("maps malformed descriptor content over git transport to registry.invalid", async () => {
  const fixture = await createDescriptorRepository("schema_version: 2");
  try {
    await expect(
      loadRegistry(
        SSH_LOCATOR,
        fetchMustNotRun(),
        gitRunnerMappingLocators({ [SSH_LOCATOR]: fixture.fileUrl }),
      ),
    ).rejects.toMatchObject({ code: "registry.invalid" });
  } finally {
    await removeDescriptorRepository(fixture);
  }
});
