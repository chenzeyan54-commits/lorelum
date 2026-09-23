# Manage Knowledge Packs

Pack mutations operate on one LocalStore. Use the global `--store-root <path>` option to select an
isolated Store for development or automation; Registry catalog state remains user-level and is not
selected by this option.

当前 release 选择、source route 和 replacement boundary 以 [pack-management spec](../../openspec/specs/pack-management/spec.md)
为准；本页说明 CLI 的 ownership、协议分支和 source 安全边界。面向 Pack 使用者的命令与恢复
说明在站点的[安装与管理 Pack](https://lorelum.com/en/docs/packs)（中文：[安装与管理 Pack](https://lorelum.com/zh/docs/packs)）。

```sh
# Built-in official source, or the user's explicit Registry default.
lore pack install agentic-coding

# Saved alias or one-time remote Git locator.
lore pack install team-pack@0.1.0 --registry team
lore pack update team-pack@0.2.0 --registry https://git.example.com/acme/team-packs.git

# One transient local Pack directory.
lore pack install --path ./packs/team-pack
lore pack update --path ../team-pack
```

## Source selection and ownership

`packages/cli/src/install/registry-selection.ts` resolves the source before descriptor or Pack
materialization:

- `--registry <alias>` selects a saved remote or local-Git Registry alias.
- `--registry <locator>` selects one transient remote Git locator; it is never written to the catalog.
- Without `--registry`, the saved default is used; no saved default means built-in `official`.
- The selected source is authoritative for that mutation. A missing Pack, missing release, access error,
  or descriptor failure does not search another source or silently fall back to `official`.

The catalog is owned by `@lorelum/config` at `~/.lorelum/registries.yaml`. It is separate from
`config.yaml`, project `.lorelum/config.yaml`, and LocalStore state. `lore registry list` only reads
the catalog; it does not probe remote repositories. The catalog stores canonical remote Git locators
or canonical local-Git worktree roots, never credentials. Local worktree paths are not returned in
public mutation results. Atomic replacement, private permissions, lock contention, and strict schema
validation belong to the config package; CLI maps their typed failures to `registry.catalog-invalid`
and `registry.catalog-busy`.

`lore registry add` validates the selected remote descriptor or local worktree before persistence.
`registry remove` and `registry set-default official` are the recovery path for an intentional source
change. A malformed catalog is not treated as “no catalog” and must not silently switch the supply
source.

## Remote Git boundary

`packages/cli/src/install/load-registry.ts` owns the only remote locator resolver. GitHub `owner/repo`
and strict canonical GitHub HTTPS keep the historical anonymous raw descriptor path. Other accepted
HTTPS, `ssh://`, and SCP-style SSH locators use the constrained Git descriptor route. The resolver
rejects web/raw descriptor URLs, `http:`, `file:`, `git:`/`git://`, remote helpers, URL credentials,
query/fragment suffixes, control characters, and path traversal.

Remote Git invocations use argument vectors and a non-interactive environment. Explicit Git
configuration denies protocol/helper rewrites and credential helpers for these child processes,
while normal SSH agent and known-host verification remain available. The partial-clone filter is a
bounded transfer request, not a cross-server byte guarantee. Raw descriptor failure never falls back
to Git, and generic Git failure never guesses a raw URL.

Remote success keeps the existing `registry: { name, repository }` identity for GitHub-compatible
sources; generic remote identities include the host. The `source` branch is
`{ type: "git", ref, commit }`. Registry release materialization must use the same validated repository
as descriptor loading.

## Local Git Registry

`lore registry add <alias> --path <worktree>` requires a readable Git worktree whose `HEAD` contains
`.lorelum/registry.yaml`. `packages/cli/src/install/local-registry.ts` reads the descriptor from that
worktree; `materializeLocalRegistryRelease()` resolves refs and reads tree/blob objects from the same
object database without clone, fetch, checkout, ref updates, network, or helper protocols. Promisor
worktrees therefore fail as `source.unavailable` when a required object is absent; they do not lazy-fetch
from the configured remote.

Local Registry mutation results use `registry: { name, alias }` and
`source: { type: "local-git", ref, commit }`. The worktree root and temporary materialization path
must not appear in the envelope or Store provenance. Existing Store `packRoot` semantics remain
unchanged.

## Direct local Pack directory

`pack install --path <directory>` and `pack update --path <directory>` are a separate source route from
local Git Registry. The handler validates the exclusive selector, checks directory availability, and
delegates all Pack format checks to `decodePackDirectory()`.

The directory route does not call Registry selection, descriptor loading, release resolution, Git
materialization, fetch, or a Registry/network client, and it never writes the source path into a
manifest. Store install/upgrade and post-commit index behavior remain shared with Registry-backed
mutations. The user-facing command forms, recovery guidance, and source lifecycle are documented in
[Install and manage Packs](https://lorelum.com/en/docs/packs).

Install/update result schemas are source-route unions. Registry branches retain `registry`, Git source
identity, Pack/Store mutation data, and (for install) `indexSync`. Directory branches contain
`source: { type: "directory" }`, Pack/Store mutation data, and (for install) `indexSync`, but no
Registry, Git ref/commit, or source directory path.

## Store and lifecycle notes

Pack content is committed to the selected LocalStore before derived index work is reported. A failed
install index operation leaves the canonical Pack installed and returns an `indexSync` failure state;
the caller can run the normal index recovery flow. Updating an installed Pack remains an explicit
operation: installing a changed artifact returns `pack.update-required` instead of silently replacing
it. `pack update` and `pack remove` return `pack.not-installed` when the named Pack is not active.

All successful mutations expose the existing `generation`, `effectiveRevision`, Practice `delta`,
validation `diagnostics`, `cleanupPending`, `artifactDigest`, idempotency, and public `packRoot` data.
Use `lore describe` as the protocol source for the exact result schema and visible error allowlist;
do not infer fields from default text formatting.
