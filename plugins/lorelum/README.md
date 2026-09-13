# Lorelum

This is the first Codex integration for Lorelum. It brings relevant engineering Practices into Codex when they can inform a task or decision, without loading every rule at once. Its progressive-disclosure flow is:

1. A compact **Installed Pack Catalog** makes the locally available Knowledge Packs discoverable.
2. The Lorelum Skill uses that catalog as a relevance hint, not as the full engineering rules or a hard filter.
3. Codex queries targeted Practice summaries when the task, decision, verification, or recovery moment could benefit from them.
4. Before applying a Practice or claiming that work follows it, Codex reads the full Practice.

The bundled runtime integration calls `lore list packs`, the rich Pack metadata command defined by the list catalog contract (ADR 0014). It runs for supported `SessionStart` sources, including `compact`, so the Catalog is regenerated before Codex continues after compaction. The command invocation is isolated in `scripts/inject-pack-index.ts`; set `LORELUM_CLI_COMMAND` and `LORELUM_CLI_ARGS` (a JSON array of strings) to test with a custom executable, and pass a custom source in unit tests.

The integration requests Pack metadata only. It does not install or update Packs, or proactively run `lore query` or `lore get`; opening the LocalStore still follows its normal lifecycle. If the CLI is unavailable or returns malformed data, the integration writes a diagnostic to stderr and lets the host continue without additional context.

## Retrieval availability

`lore query` defaults to local semantic retrieval, which requires a running Backend, a loaded model, and an index for the selected Store. An unavailable semantic query does not mean no relevant Practice exists, and the Plugin does not start, configure, or download those dependencies automatically. Use `--mode keyword` only when the explicit offline keyword path is appropriate.

## Installation

This Plugin is a Codex adapter. It requires both `bun` and a compatible Lorelum CLI available as `lore` on `PATH`; it does not embed, build, or update either dependency. See the [Codex installation guide](../../docs/plugins/codex.md) for the public marketplace commands and [the development guide](../../docs/development/plugins.md) for a checkout-backed development install.

### Windows notes

Codex runs hook commands through PowerShell on Windows, so `commandWindows` uses PowerShell syntax (`$env:PLUGIN_ROOT`), and `bun` must resolve to a real executable on `PATH` — the shim script that `npm install -g bun` creates will not run. Hooks are gated by review: after any change to `hooks.json`, re-trust them in the Codex plugin UI, otherwise Codex silently skips them.

## Local validation

From the repository root:

```powershell
python "$env:USERPROFILE\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" plugins\lorelum
bun test plugins/lorelum/scripts
```

The CLI and Store integration is connected end to end: the hook spawns `lore list packs` against the LocalStore and renders the returned summaries. To smoke-check it, install Packs into an isolated Store root, then run the command and pipe a hook event through the script:

```powershell
bun packages/cli/src/main.ts list packs --store-root D:\Temp\lore-e2e-store
$env:LORELUM_CLI_COMMAND = "bun"
$env:LORELUM_CLI_ARGS = '["packages/cli/src/main.ts","list","packs","--store-root","D:/Temp/lore-e2e-store"]'
'{"hook_event_name":"SessionStart"}' | bun plugins/lorelum/scripts/inject-pack-index.ts
```
