# Lorelum

This is the first Codex integration for Lorelum. It brings relevant engineering Practices into Codex when they can inform a task or decision, without loading every rule at once. Its progressive-disclosure flow is:

1. A compact **Installed Pack Catalog** makes the locally available Knowledge Packs discoverable.
2. The Lorelum Skill uses that catalog as a relevance hint, not as the full engineering rules or a hard filter.
3. Codex queries targeted Practice summaries when the task, decision, verification, or recovery moment could benefit from them.
4. Before applying a Practice or claiming that work follows it, Codex reads the full Practice.

The bundled runtime integration calls `lore hook codex`, the versioned Codex Hook ABI introduced in Lorelum CLI v0.1.0. It runs for supported `SessionStart` sources, including `compact`, so the Catalog is regenerated before Codex continues after compaction. The CLI reads the Hook payload from stdin and writes the Codex `hookSpecificOutput` envelope directly to stdout.

The integration requests Pack metadata only. It does not install or update Packs, or proactively run `lore query` or `lore get`; opening the LocalStore still follows its normal lifecycle. If the CLI is unavailable or returns malformed data, the integration writes a diagnostic to stderr and lets the host continue without additional context.

## Retrieval availability

`lore query` defaults to local semantic retrieval, which requires a running Backend, a loaded model, and an index for the selected Store. An unavailable semantic query does not mean no relevant Practice exists, and the Plugin does not start, configure, or download those dependencies automatically. Use `--mode keyword` only when the explicit offline keyword path is appropriate.

## Installation

This Plugin is a Codex adapter. Ordinary users need Lorelum CLI v0.1.0 or later, available as `lore` on `PATH`; it does not embed, build, or update the CLI. Bun is only required for maintainers running the source and test workflows. See the [Codex installation guide](../../docs/plugins/codex.md) for the public marketplace commands and [the development guide](../../docs/development/plugins.md) for a checkout-backed development install.

### Windows notes

Codex runs hook commands through PowerShell on Windows. The Plugin invokes the compiled `lore` command directly and does not require Bun or Node on the user machine. Hooks are gated by review: after any change to `hooks.json`, re-trust them in the Codex plugin UI, otherwise Codex silently skips them.

## Local validation

From the repository root:

```powershell
python "$env:USERPROFILE\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py" plugins\lorelum
bun test plugins/lorelum/scripts
```

The CLI and Store integration is connected end to end: the Hook runs `lore hook codex` against the LocalStore and renders the returned summaries. To smoke-check current source, install Packs into an isolated Store root, then pipe a Hook event through the source entrypoint. This source-only check requires Bun; an installed Plugin does not.

```powershell
'{"hook_event_name":"SessionStart"}' | bun packages/cli/src/main.ts hook codex --store-root D:\Temp\lore-e2e-store
```
