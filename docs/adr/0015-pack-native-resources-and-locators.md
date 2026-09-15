# ADR 0015: Pack-native resources and verified locators

- **Date:** 2026-09-15
- **Status:** Proposed (local implementation)
- **Related:** ADR 0003, ADR 0007, ADR 0008, ADR 0009, ADR 0011, ADR 0014

## Context

The original runtime Pack artifact contains `pack.yaml`, `practices/**/*.md`, and optional `decisions.yaml`. Authors may put templates, detailed references, or helper scripts beside those files, but Registry materialization, directory decoding, and sealed-artifact reconstruction previously discarded them. A retrieved Practice therefore could not reliably point a host to Pack-native material after installation.

Agent Skills demonstrate a useful progressive-loading pattern—discover a capability, read its main instruction, then load a reference or explicitly run a helper only when needed—but a Lorelum Practice is not a Host Skill. Lorelum's core unit remains a retrievable, standalone decision. Adding descriptors, script runners, permission declarations, or file-oriented query would turn a small content-format extension into a host-execution platform.

The system also needs a stable local way to resolve a selected resource. Artifact paths, SQLite rows, and Store projections are deliberately private; a host must not reverse-engineer them or use a mutable source checkout.

## Decision

### Resource directories and links

A Pack may include these optional Pack-root directories:

```text
references/
assets/
scripts/
```

Their nested regular files are Pack-native resources. There is no attachment manifest, resource ID, descriptor, entrypoint declaration, or cross-Pack reference. A Practice uses normal Markdown to route a supplementary file:

```markdown
[API compatibility matrix](resource:references/api-compatibility.md)
```

The `resource:` path is Pack-root-relative, begins with one allowed directory, and refers to a validated regular file in the same Pack. It is not a workspace alias, execution permission, or file-access allowlist. Inline code, fenced code, ordinary URLs, and ordinary Markdown links keep their normal meaning.

Directory names communicate the next action: read a reference on demand, copy an asset before editing it, or explicitly run a script only under current-task authorization. The Practice retains its trigger, action, direct reason, material exception, and stopping condition; resources add depth or helpers but cannot hide the decision.

### Artifact lifecycle, validation, and retrieval

Resources follow existing Pack safety and byte budgets, reject symlinks and special files, and are stored verbatim in the immutable Pack artifact. Registry materialization, local decoding, snapshot writing, artifact verification, reindex, and recovery preserve and verify these bytes. A resource path or byte change creates a new artifact identity and Pack generation.

Resources do not enter canonical Practice content, Effective Practice reconciliation, keyword or semantic indexes, query candidates, or ranking. A resource-only update does not advance `effectiveRevision` or generate index work. A `resource:` link in a Practice body is canonical Practice text, so changing the link follows ordinary content-digest and revision rules.

`lore validate <pack-root>` reports unsafe resource directories, budget failures, and invalid or missing `resource:` targets as machine-readable structural diagnostics. It never executes scripts, installs dependencies, accesses credentials, connects to the network, or interprets resource-domain semantics. Unlinked helper files and grouped assets remain valid.

### Engine-resolved, source-scoped locators

`lore get` returns `sources[].packRoot` with the existing `packName` and `sourcePath`. `lore pack list`, `lore pack list --details`, and `lore pack list <name>` return `packRoot` for each explicit Pack entry. The Engine derives each absolute root from the active manifest and validates the relevant sealed artifact in the same consistent snapshot used for the result. The CLI only projects Engine values; it never constructs artifact paths or scans a Store.

Multiple sources retain separate roots. A locator may become stale after a mutation, in which case callers run `lore get` or `lore pack list` again rather than infer a new Store path. `query` does not return `packRoot`, resource paths, lists, or contents. The Codex SessionStart Hook Catalog returns each installed Pack's current `packRoot` as Pack-level discovery data, while still omitting resource paths, resource lists, resource contents, and Practice bodies.

### Non-goals

This decision adds no script runner, sandbox, dependency installation, automatic network access, tool or permission DSL, local MCP server, resource subcommands, resource full-text search, descriptor, or automatic resource injection. A host may browse a selected `packRoot` under its normal file permissions; `resource:` does not reduce access to only declared targets.

## Consequences

Pack authors can distribute detailed reading material, editable templates, binaries, and helpers without losing them during installation or recovery. Hosts receive an explicit verified artifact locator from a selected Practice or Pack and, in Codex, from each Catalog entry at SessionStart. The Catalog exposes only the Pack root, so progressive resource loading and the Practice's task-specific route remain intact without Store-layout coupling.

Strict `lore get` and `lore pack list` consumers must accept required `packRoot` fields. `lore get` rejects corruption in a selected source artifact before returning its locator, while avoiding a whole-Store audit of unrelated Pack artifacts. Resource bytes add artifact storage and hashing work, but not retrieval-index budget.

**Follow-ups:**

- Sync this accepted decision into current OpenSpec capability specs before calling it a stable public contract.
- Release `pack-creator@0.2.0` only through a new immutable tag and Registry entry, then record separate structural, install/readback, retrieval, and downstream-Agent evidence.
- Revisit independent resource discovery, script execution policy, or remote retrieval only when a concrete user scenario justifies a separate design.
