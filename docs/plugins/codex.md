# Lorelum

Lorelum's Codex integration makes installed Knowledge Packs discoverable in a compact context catalog, then lets Codex retrieve full Practices only when they are relevant to the task or decision. The Plugin is displayed as **Lorelum** and is distributed in the `lorelum` marketplace, so the public selector is `lorelum@lorelum`.

## Prerequisites

The Plugin requires Lorelum CLI v0.1.0 or later, available as `lore` on `PATH`. That release introduces the `lore hook codex` ABI used by the Plugin. Bun and Node are not ordinary-user prerequisites: the installed Plugin invokes the compiled `lore` executable directly.

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

At `SessionStart` events including `compact`, the Hook calls `lore hook codex` and injects an **Installed Pack Catalog**. The catalog contains Pack names, versions, descriptions when available, and declared stack scope. It is routing metadata, not full Practice guidance, and it may be truncated to fit the host context budget.

The Lorelum Skill uses the catalog as a relevance hint. Missing or omitted Pack metadata does not establish that no relevant guidance exists. Before applying a Practice or saying that a plan follows it, Codex reads the complete Practice with `lore get <practice-id>`.

## Troubleshooting

- If no catalog appears, first run `lore --version` in the environment that starts Codex and confirm it is v0.1.0 or later. The Hook degrades without blocking Codex when that CLI is unavailable, older, or returns invalid data.
- If semantic query is unavailable, that does not mean no relevant Practice exists. Prepare the local Backend, model, and Store index explicitly, or use `--mode keyword` only when an offline lexical search is appropriate.
- A catalog truncated by the context budget does not imply that omitted Packs are uninstalled. Run `lore pack list --details` when refreshing discovery would help.

For checkout-backed development and hot reload, see [Plugin development](../development/plugins.md).
