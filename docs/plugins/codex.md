# Lorelum

Lorelum's Codex integration makes installed Knowledge Packs discoverable in a compact context catalog, then lets Codex retrieve full Practices only when they are relevant to the task or decision. The Plugin is displayed as **Lorelum** and is distributed in the `lorelum` marketplace, so the public selector is `lorelum@lorelum`.

## Scope

This integration is intentionally CLI-first. It uses the released `lore` executable, the Lorelum Skill, and the Codex Hook; it does not run a local MCP server or expose local MCP tools. Do not add MCP as a local convenience or performance optimization. MCP is reserved for a separately approved future platform remote-retrieval service.

The current host integration contract is [agent-integration](../../openspec/specs/agent-integration/spec.md); this guide explains Codex setup and recovery without defining a second retrieval contract.

## Prerequisites

The Plugin requires Lorelum CLI v0.1.0-alpha.1 or later, available as `lore` on `PATH`. That public alpha introduces the `lore hook codex` ABI used by the Plugin. Bun and Node are not ordinary-user prerequisites: the installed Plugin invokes the compiled `lore` executable directly.

If an older or unavailable CLI cannot run `lore hook codex`, the Hook wrapper writes `{ "continue": true }` instead of blocking Codex. No Pack Catalog is injected until the compatible CLI is installed. The Plugin does not download models, start the Backend, build semantic indexes, or modify Packs. Semantic query preparation is documented in [the query CLI guide](../cli/query.md).

## Install and update

Add the official marketplace once, then install the Plugin:

```sh
codex plugin marketplace add lorelum/lorelum
codex plugin add lorelum@lorelum
```

When a newer Plugin version is available, refresh the marketplace and reinstall the selector:

```sh
codex plugin marketplace upgrade lorelum
codex plugin add lorelum@lorelum
```

After an install or update, start a new Codex task so its Skill and Hook configuration are loaded. If Codex asks you to review Hooks, review and trust the current `hooks/hooks.json`; changes to that file require a new trust decision.

## What it injects

At `SessionStart` events including `compact`, the Hook calls `lore hook codex` and injects an **Installed Pack Catalog**. The catalog contains Pack names, versions, descriptions when available, declared stack scope, and each current `packRoot`. It is Pack-level routing data, not full Practice guidance or a resource listing, and it may be truncated to fit the host context budget.

The Lorelum Skill uses the catalog as a relevance hint and can use a known Pack's root for Pack-level browsing. Missing or omitted Pack metadata does not establish that no relevant guidance exists. At a material task, planning, high-risk-boundary, verification, recovery, or completion moment where guidance may help, the Skill runs one targeted natural-language semantic query before deciding retrieval is not worth attempting. Before applying a Practice or saying that a plan follows it, Codex reads the complete Practice with `lore get <practice-id>` and preserves its source root when resolving a linked resource. The Hook never automatically runs `lore query` or `lore get`.

## Troubleshooting

- If no catalog appears, first run `lore --version` in the environment that starts Codex and confirm it is v0.1.0-alpha.1 or later. The Hook degrades without blocking Codex when that CLI is unavailable, older, or returns invalid data.
- A ready semantic query is the normal path; expected latency alone is not a reason to skip it, and this documentation makes no fixed-latency promise. The Skill starts by issuing its targeted semantic query; do not preflight Backend, model, index, or status commands. `data.state: "preparing"` is neither an empty result nor evidence that no Practice applies. Only after the query reports preparation or an error should the caller follow the documented model or index recovery path and retry the same query. Use `--mode keyword` only for an intentional offline lexical lookup or semantic-runtime diagnosis, and identify the result as keyword retrieval.
- A catalog truncated by the context budget does not imply that omitted Packs are uninstalled. Run `lore pack list --details` when refreshing discovery would help.

For checkout-backed development and hot reload, see [Plugin development](../development/plugins.md).
