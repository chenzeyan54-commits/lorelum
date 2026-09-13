# Lorelum

Lorelum's Codex integration makes installed Knowledge Packs discoverable in a compact context catalog, then lets Codex retrieve full Practices only when they are relevant to the task or decision. The Plugin is displayed as **Lorelum** and is distributed in the `lorelum` marketplace, so the public selector is `lorelum@lorelum`.

## Prerequisites

The Plugin calls two local commands:

- `bun`, to run its hook script;
- `lore`, the Lorelum CLI, to read Pack metadata and retrieve Practices.

Install a compatible Lorelum CLI and make both commands available on `PATH` before enabling the Plugin. The Plugin does not download models, start the Backend, build semantic indexes, or modify Packs. Semantic query preparation is documented in [the query CLI guide](../cli/query.md).

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

At `SessionStart` events including `compact`, the Hook calls `lore list packs` and injects an **Installed Pack Catalog**. The catalog contains Pack names, versions, descriptions when available, and declared stack scope. It is routing metadata, not full Practice guidance, and it may be truncated to fit the host context budget.

The Lorelum Skill uses the catalog as a relevance hint. Missing or omitted Pack metadata does not establish that no relevant guidance exists. Before applying a Practice or saying that a plan follows it, Codex reads the complete Practice with `lore get <practice-id>`.

## Troubleshooting

- If no catalog appears, first check that `bun` and `lore` both resolve in the environment that starts Codex. The Hook degrades without blocking Codex when the CLI is unavailable or returns invalid data.
- If semantic query is unavailable, that does not mean no relevant Practice exists. Prepare the local Backend, model, and Store index explicitly, or use `--mode keyword` only when an offline lexical search is appropriate.
- A catalog truncated by the context budget does not imply that omitted Packs are uninstalled. Run `lore list packs` when refreshing discovery would help.

For checkout-backed development and hot reload, see [Plugin development](../development/plugins.md).
