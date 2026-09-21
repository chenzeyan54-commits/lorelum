## Lorelum __RELEASE_TAG__

> Alpha.4 adds first-party Cursor and WorkBuddy integrations, trace-bounded local diagnostics and feedback drafts, clearer local process identities, and new official Knowledge Pack releases. If you maintain scripts that invoke the bundled native executable by path, replace `llama-server` with `lore-model`.

Lorelum alpha.4 expands the supported Agent surface while making local recovery and release artifacts easier to recognize. It adds first-party Cursor and WorkBuddy Plugins, trace-bounded diagnostics and local feedback drafts, Lorelum-specific process names for the Backend and embedded model runtime, and independent official Pack updates.

## Highlights

### First-party Cursor and WorkBuddy integrations

Cursor and WorkBuddy now join Codex and ZCode as supported first-party Plugin hosts. Each integration ships a host-native Plugin, a `/lore` command, a SessionStart Hook that provides the installed Pack Catalog, and a host-adapted Lorelum Skill.

The integrations keep Lorelum CLI-first: host artifacts call the released `lore` command and use native Hook contracts rather than running a local MCP server. Follow the Cursor or WorkBuddy setup guide to install or update the Plugin, enable the host's Hooks, and start a new task before relying on the catalog injection.

### Clearer local Backend and model process identities

The local daemon now requests the display name `lore-backend` on hosts that honor it. The distributed native embedding executable is now named `lore-model` on macOS, Linux, and Windows, replacing the release-path name `llama-server`.

This makes Lorelum-owned processes easier to distinguish in process viewers and when diagnosing an upgrade. Windows release binaries also carry Lorelum product metadata and an application icon. The normal installers validate and install the renamed runtime automatically.

### Trace-bounded local diagnostics and feedback drafts

Ordinary CLI failures now include `diagnostics.traceId`. When a failure blocks work or you explicitly need to diagnose it, inspect only the original invocation's managed local records:

    lore logs --trace-id <traceId> --limit 100

This command does not start a Backend or model, rerun the command, or scan unrelated traces. If records are missing, rotated, damaged, or were never captured at the requested level, Lorelum reports that evidence limit instead of substituting another invocation. Raw host Hook stdout remains host-native and does not receive ordinary CLI trace metadata.

Use `lore --debug` for one controlled reproduction without changing persistent logging configuration or another concurrent request. `lore feedback draft --trace-id <traceId> --kind bug` writes local `report.json` and `report.md` files under `~/.lorelum/feedback/`; it does not upload diagnostics, open a browser, or create an Issue. Review any local evidence before choosing to share it publicly.

### Official Pack catalog updates

The official Pack repository now includes `agentic-coding@0.5.1`: 34 step-style decision procedures with explicit stopping points, severity tiers, revised retrieval triggers, and two planning-calibration Practices. `0.5.1` also retunes the catalog description to name those planning-calibration moments. `pack-creator@0.2.0` adds guidance for project-local Packs alongside authoring, evaluation, and Registry release work.

Knowledge Packs are versioned independently from the CLI. Install or update them only when you want their new guidance in a Store.

## Upgrade notes

### Update direct native-runtime paths

Normal installations require no manual action. If a local script, wrapper, or process check directly invokes `native/<target>/llama-server` or `llama-server.exe` inside a Lorelum release directory, update that path to `lore-model` or `lore-model.exe`. The upstream project remains llama.cpp; only Lorelum's distributed executable name has changed.

### Install or update host Plugins

Install the Cursor or WorkBuddy Plugin from its documented marketplace flow, then start a new task so its SessionStart Hook can run. Older CLI versions degrade safely when a new host Hook is unavailable, but they do not provide the new catalog injection.

### Diagnose one original failure before retrying it

Copy the `diagnostics.traceId` from an ordinary CLI failure, then inspect only that trace before running a reproduction:

    lore logs --trace-id <traceId> --limit 100

If the retained trace does not explain the failure and you control a safe minimal reproduction, run that reproduction with `--debug`. It creates a new trace; do not present its records as if they came from the original failure. The updated Troubleshooting guide describes the complete trace, debug, and feedback flow.

### Create feedback drafts locally first

Use the original trace to prepare a reviewable local draft:

    lore feedback draft --trace-id <traceId> --kind bug

This is not a support submission. It does not create or update a GitHub Issue, and a local draft does not authorize a Core, Pack, Skill, Plugin, documentation, or evaluation change. If you later submit evidence publicly, choose the material deliberately and remove credentials, secrets, or anything else you do not want to disclose.

### Update official Packs deliberately

To select the new Pack releases in an existing Store:

    lore pack update agentic-coding@0.5.1
    lore pack update pack-creator@0.2.0

Pack installation commits canonical Pack content even when derived semantic-index work remains pending or fails. Inspect `data.indexSync`, then run `lore index build` only when you need semantic retrieval ready in that Store.

### Pack, Store, and index compatibility

Pack formats, LocalStore data, indexes, and retrieval behavior remain alpha-stage contracts. This release does not promise an automatic migration. Keep a backup or use an isolated `--store-root` before evaluating it in a shared environment.

## Install __RELEASE_TAG__

### macOS on Apple Silicon and Linux x64

    curl -fsSL https://raw.githubusercontent.com/lorelum/lorelum/main/install.sh | sh -s -- --version __RELEASE_VERSION__

### Windows x64

    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/lorelum/lorelum/main/install.ps1))) -Version __RELEASE_VERSION__

The installers download the matching archive and `SHA256SUMS`, verify the archive checksum, and install the complete release directory. On Windows, run the PowerShell command from an already-open session so any installer error remains visible.

## Downloads

Use the installers above for normal installation. These assets are available for manual or offline use:

- lore-__RELEASE_VERSION__-darwin-arm64.tar.gz — macOS on Apple Silicon
- lore-__RELEASE_VERSION__-linux-x64.tar.gz — Linux x64
- lore-__RELEASE_VERSION__-win32-x64.zip — Windows x64
- lore-__RELEASE_VERSION__-darwin-arm64.metadata.json
- lore-__RELEASE_VERSION__-linux-x64.metadata.json
- lore-__RELEASE_VERSION__-win32-x64.metadata.json
- SHA256SUMS — SHA-256 checksums for every archive and metadata file

macOS on Apple Silicon is Lorelum's priority platform and the most thoroughly validated release target. Linux x64 and Windows x64 are best-effort targets; compatibility and performance across every operating-system build, hardware configuration, and local security policy are not guaranteed.

## Alpha compatibility

CLI behavior, Pack formats, local Store data, indexes, and retrieval results may change before the first stable release. Automatic migration is not guaranteed.

## Full changelog

[Compare v0.1.0-alpha.3 to __RELEASE_TAG__](https://github.com/lorelum/lorelum/compare/v0.1.0-alpha.3...__RELEASE_TAG__)

## Verification

The release workflow builds on macOS, Linux, and Windows; verifies every checksum; unpacks each archive; checks the CLI and native-runtime version commands; and exercises the packaged Backend start and status lifecycle on the matching runner.
