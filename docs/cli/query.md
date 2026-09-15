# Query installed Practices

当前可观察合同见 [retrieval query OpenSpec](../../openspec/specs/retrieval-query/spec.md)；本页说明 CLI 参数、JSON 输出与恢复操作。

`lore query <text>` 在当前 query context 中检索 Practice 并返回小型 summary。默认使用本地 semantic retrieval；`--mode keyword` 保留离线 FTS5 路径。当前目录或父目录存在 `.lorelum/` 时，query context 会按父到子合并 ProjectContext；没有 marker 或传入 `--no-project` 时才是纯 LocalStore。

```sh
# Semantic is the default. A normal query starts the Backend and automatically prepares the fixed local model when needed.
lore query "React 登录页接入现有认证接口"
lore query "database migration rollback" --top-k 10

# Explicit zero-configuration, offline keyword retrieval.
lore query "database migration rollback" --mode keyword

lore --store-root /path/to/isolated-store query "request validation"
lore query "request validation" --project-root /path/to/project
lore query "request validation" --no-project
lore query "request validation" --cache-root /path/to/user-cache
lore describe query
```

The positional text is trimmed before validation. It must contain at least one non-whitespace character and may contain at most 4,096 Unicode code points after trimming. `--top-k` is optional, defaults to `5`, and accepts a decimal positive integer from `1` through `50`. `--mode` accepts `semantic` (the default) or `keyword`. `--project-root` selects an ordinary directory directly containing `.lorelum/`; it does not require Git. `--no-project` disables layer discovery. `--cache-root` selects only user-owned derived artifacts, never source Pack files or LocalStore.

Parent and child `.lorelum/` layers inherit by default. A child config adds or overrides declared fields and same-ID Practices, while unaffected parent/Store Practices stay in the candidate set. A malformed local Practice is ignored without hiding valid neighbors or a lower-priority fallback; query returns the remaining current winners and `lore context status` exposes the degraded context.

## Semantic mode

Semantic mode uses the fixed local Profile and the selected Store's previously built semantic index. When the Backend is stopped, a query starts it. When the index is usable but the model is absent or unloaded, Backend starts or joins the fixed model's configured download and preparation. A query observes that work for a short bounded interval; it never builds an index itself.

For a new machine, install a Pack normally. If model preparation is still running, query returns a machine-readable preparing result rather than waiting for the whole transfer:

```sh
lore --store-root /path/to/store pack install agentic-coding
lore --store-root /path/to/store query "how should I verify this release?"
```

Existing Stores created before automatic install synchronization can use `lore index build` once. After that, ordinary semantic queries need neither `backend start` nor `model load`. If the first query returns preparing, inspect `lore model status` and retry after it becomes ready. Explicit `lore model load` remains useful when a prior download failed and the user wants to wait for its retry.

The successful result includes the Profile identity and how completely the active index covers the Store snapshot:

```json
{
  "mode": "semantic",
  "profileId": "...",
  "coverage": "complete",
  "results": []
}
```

`coverage: "complete"` means the index and Store snapshot are identical. `coverage: "partial"` means the Store changed after the index was built, but Lorelum could use a continuous change history to exclude every affected Practice and safely return results from the remaining vectors. If that safety proof is unavailable, the command fails and asks for an explicit `index build`; it never silently switches to keyword retrieval.

## Keyword mode

`--mode keyword` runs directly in Engine, does not need a Backend or model, and does not access the network. For a ProjectContext it maintains a content-addressed FTS5 artifact under the user cache, not under `.lorelum/`; for Store-only it retains the Store-derived index path. In both cases canonical Practice rows/files remain the source of returned summaries. A missing or corrupt artifact is rebuilt from a consistent current snapshot.

## Shared result behavior

Both modes return one JSON protocol envelope on stdout. `results` may be empty and contains at most `top-k` entries. Results are Practice summaries, not source files. They omit the full body and internal scores; use `lore get <practice-id>` to retrieve the complete canonical Practice. Results are deterministic for the same Store snapshot and query implementation. A query does not pin a revision for a later `get` invocation.

When automatic preparation has been accepted but is not ready within the observation interval, semantic query returns `ok: true`, exit code `1`, and no results:

```json
{
  "state": "preparing",
  "preparationId": "<uuid>",
  "message": "The local model is preparing in the background. Check lore model status, then retry this query."
}
```

## Errors and exit codes

Ready query results exit `0`. A successful preparing result exits `1`. Failures use `ok: false` with `error: { code, message }` and exit `2`. All paths write exactly one JSON line to stdout. Callers should branch on `data.state` or `error.code`, not parse the message.

| Code | Meaning |
| --- | --- |
| `usage.invalid` | Missing or invalid text, `--top-k`, or `--mode`. Validation happens before a semantic query connects to the Backend. |
| `backend.*` | The automatic Backend start could not safely complete because of incompatibility, a port conflict, busy state, or a deadline. Inspect it with `lore backend ...`. |
| `embedding.*` | Automatic preparation was disabled, failed, or cannot safely continue. Check `lore model status`; fix configuration/resources, then use `lore model load` to retry and wait. |
| `semantic.index-not-ready` | No usable index exists, or Store history cannot safely bridge its age. Run `lore index build`. |
| `semantic.index-incompatible` | The index does not match the fixed Profile or selected Store. Run `lore index rebuild`. |
| `semantic.index-failed` / `semantic.embedding-failed` | The stored index or query embedding violates its contract. Rebuild the index; inspect model status for embedding failures. |
| `query.unavailable` / `query.failed` | The explicit keyword index could not be searched. |
| `store.busy` / `store.recovery-required` | The selected Store kept changing, is mutating, or needs recovery. |
| `runtime.unexpected` | An undeclared internal failure prevented completion. |
