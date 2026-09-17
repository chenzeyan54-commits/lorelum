## Lorelum __RELEASE_TAG__

> Upgrading from alpha.2? Install this release before retrying semantic retrieval on Windows. If an integration parses command output, make its JSON requirement explicit with --json.

Lorelum alpha.3 is a focused reliability and integration release after alpha.2. It fixes the Windows x64 native runtime failure that could leave semantic indexing waiting forever, makes terminal semantic failures actionable, and adds ZCode and private GitHub Pack-registry support.

## Highlights

### Windows x64 semantic retrieval starts reliably

The bundled Windows native embedding runtime no longer exits silently before it can serve requests. This resolves the failure mode where a semantic query or index operation could remain in an apparent indexing state even though the native process had already stopped.

The parent-liveness safeguard remains active for the daemon-owned runtime. It is now opt-in for other launches, so ordinary CLI and runtime checks can start and remain available as intended.

### Confirmed semantic failures are no longer reported as progress

When model preparation or semantic indexing reaches a terminal failure, Lorelum now returns the typed failure and recovery information instead of continuing to report that the index is still building. This lets users and host integrations distinguish background work that may complete from work that needs a recovery action.

### Project discovery ignores the user Store as a project layer

ProjectContext discovery no longer mistakes the selected global Store for a repository-local .lorelum layer. Running Lorelum below a user Store no longer injects Store configuration or artifact Packs into the project corpus or produces unrelated config.invalid and pack.invalid warnings.

### Complete readable CLI output, with JSON preserved for automation

Ordinary CLI commands now render complete, readable text by default. The stable machine envelope remains available with --json.

This is a deliberate compatibility boundary: scripts, hooks, and integrations that parse stdout as JSON must pass --json explicitly.

### First-party ZCode integration

Lorelum now includes a first-party ZCode Plugin, a /lore command, and a SessionStart Hook integration alongside the Codex Plugin. The host adapters share the same CLI-first boundary: they discover the installed Pack Catalog and retrieve full Practices only when needed.

Follow the ZCode installation guide to install or update the Plugin, enable Hooks, and start a new task before relying on the updated integration.

### Private GitHub Pack registries over SSH

Pack installation now accepts supported GitHub SSH registry locators, including git@github.com:owner/repo.git and ssh://git@github.com/owner/repo.git. Lorelum reuses the user's existing SSH configuration and agent; it does not store repository credentials.

Descriptor reads are fresh and bounded. Authentication, host-key, and access failures return an actionable registry error instead of requesting credentials through Lorelum.

## Upgrade notes

### Update scripts and host integrations that consume JSON

If you previously treated ordinary command stdout as JSON, add --json to that invocation before upgrading:

    lore --json query "find the project's test policy"

Use the complete text output for an interactive terminal. Use --json whenever another program needs the protocol envelope.

### Reinstall on Windows x64

Windows users affected by semantic indexing that never completed should install __RELEASE_TAG__ through the PowerShell installer. The native runtime ships inside the versioned release directory, so retain the complete installed directory rather than copying only lore.exe.

### Pack, Store, and index compatibility

Pack formats, LocalStore data, indexes, and retrieval behavior remain alpha-stage contracts. This release does not promise an automatic migration. Keep a backup or use an isolated --store-root before evaluating it in a shared environment.

Official Knowledge Packs are versioned independently from the CLI. Update a Pack only when the Pack's own release notes recommend it.

## Install __RELEASE_TAG__

### macOS on Apple Silicon and Linux x64

    curl -fsSL https://raw.githubusercontent.com/lorelum/lorelum/main/install.sh | sh -s -- --version __RELEASE_VERSION__

### Windows x64

    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/lorelum/lorelum/main/install.ps1))) -Version __RELEASE_VERSION__

The installers download the matching archive and SHA256SUMS, verify the archive checksum, and install the complete release directory. On Windows, run the PowerShell command from an already-open session so any installer error remains visible.

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

[Compare v0.1.0-alpha.2 to __RELEASE_TAG__](https://github.com/lorelum/lorelum/compare/v0.1.0-alpha.2...__RELEASE_TAG__)

## Verification

The release workflow builds on macOS, Linux, and Windows; verifies every checksum; unpacks each archive; checks the CLI and native-runtime version commands; and exercises the packaged Backend start and status lifecycle on the matching runner.
