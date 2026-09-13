# Plugin development

This guide is for maintainers developing **Lorelum for Codex** from a checkout. It deliberately separates a user's public marketplace installation from a checkout-backed development installation: they share the same public selector, `lorelum@lorelum`, but must not be enabled together.

## Source and contract boundary

The Plugin source is [`plugins/lorelum`](../../plugins/lorelum). It is outside the Bun workspace and communicates with Lorelum only through the public `lore` CLI. Do not import Engine packages, read LocalStore files, or duplicate retrieval/ranking logic in the Plugin.

The Hook defaults to `lore list packs`; the Lorelum Skill invokes `lore query` and `lore get` when appropriate. A normal installed Plugin should therefore use the stable `lore` command from the primary checkout or a released CLI, not a command built from a temporary worktree. To validate current CLI source, use the source-entrypoint workflow in [Local CLI and multiple worktrees](./README.md#local-cli-and-multiple-worktrees) and pass it explicitly to the hook smoke test below.

## Verify source changes

From the repository root:

```sh
bun test plugins/lorelum
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py" plugins/lorelum
```

The validator may require PyYAML in the Python environment. If it is unavailable, use the test suite and JSON/YAML structural checks as a fallback, but do not treat that fallback as a successful validator run.

Smoke-test the Hook against the current CLI source without altering the global `lore` command. Use an isolated Store root for any Store-opening check:

```sh
export LORELUM_CLI_COMMAND=bun
export LORELUM_CLI_ARGS='["packages/cli/src/main.ts","list","packs","--store-root","/absolute/path/to/isolated-store"]'
printf '%s\n' '{"hook_event_name":"SessionStart","source":"compact"}' \
  | bun plugins/lorelum/scripts/inject-pack-index.ts
```

The result should contain `hookSpecificOutput.additionalContext` headed `Lorelum Installed Pack Catalog`. A `PostCompact` event is intentionally unsupported and should degrade to `{ "continue": true }`: Codex restores the catalog through the supported `SessionStart` source `compact` instead.

## Checkout-backed install and hot reload

The repository marketplace at `.agents/plugins/marketplace.json` is a public marketplace definition, but `codex plugin marketplace add` also accepts the current checkout as a local source. Do not configure that local source alongside the remote `lorelum` marketplace: both expose `lorelum@lorelum` and would make the active source ambiguous.

First inspect configured marketplaces. If the public `lorelum` marketplace is already configured, remove that source before adding the local checkout; remove the installed Plugin first only if Codex requires it:

```sh
codex plugin marketplace list
codex plugin remove lorelum@lorelum
codex plugin marketplace remove lorelum
codex plugin marketplace add "$PWD"
```

Install the Plugin from the checkout-backed marketplace:

```sh
codex plugin add lorelum@lorelum
```

For each local Plugin iteration, update the development-only cachebuster and reinstall. The helper replaces any old suffix with one timestamped suffix; it does not change the public Plugin identity.

```sh
python3 "$HOME/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py" plugins/lorelum
codex plugin add lorelum@lorelum
```

Start a new Codex task after reinstalling, and re-trust Hooks whenever `hooks/hooks.json` changes. Do not commit the cachebuster version: set the manifest back to the intended release version before committing. To return to the public source, remove the local `lorelum` marketplace, add `lorelum/lorelum`, and reinstall `lorelum@lorelum`.
