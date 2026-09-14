## Lorelum __RELEASE_TAG__

This public-alpha prerelease contains the compiled `lore` CLI and the native runtime required for local semantic retrieval.

### Release assets

- `lore-<version>-darwin-arm64.tar.gz` — macOS on Apple Silicon
- `lore-<version>-linux-x64.tar.gz` — Linux x64
- `lore-<version>-win32-x64.zip` — Windows x64
- `lore-<version>-<target>.metadata.json` — per-target build provenance
- `SHA256SUMS` — SHA-256 checksums for every archive and metadata file

### Platform support

macOS on Apple Silicon is Lorelum's priority platform and the most thoroughly validated release target. Linux x64 and Windows x64 archives are available on a best-effort basis; compatibility and performance across all distributions, system builds, hardware, and local security policies are not guaranteed.

### Install

macOS on Apple Silicon and Linux x64 use `install.sh`. Windows x64 uses the PowerShell installer below. Run it in an already-open Windows PowerShell or Windows Terminal session; do not double-click the installer, so any failure remains visible.

The Windows installer adds `$env:LOCALAPPDATA\Lorelum\bin` to the current user's `Path` when needed. Open a new terminal before running `lore`.

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/lorelum/lorelum/main/install.ps1))) -Version __RELEASE_VERSION__
```

### Alpha compatibility

CLI behavior, Pack formats, local Store data, indexes, and retrieval results may change before the first stable release. Automatic migration is not guaranteed. Use an isolated Store root when evaluating an upgrade.

### Verification

The release workflow verifies every uploaded checksum, unpacks each archive, checks the CLI and native runtime version commands, and exercises the packaged Backend start/status lifecycle on its matching runner.
