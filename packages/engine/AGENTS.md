# AGENTS.md — packages/engine

`@lorelum/engine` owns retrieval semantics, Store-derived data, and their verification boundaries.

## Ownership and dependency boundary

`@lorelum/engine` owns retrieval semantics and Store-derived data: LocalStore snapshots, canonical Practice reads, keyword and semantic indexes, ranking, candidate validation, result assembly, and derived-index recovery.

- Engine must not import `@lorelum/backend`, Elysia, CLI code, an HTTP client, or a model runtime.
- Canonical LocalStore data is the source of truth. Keyword and semantic indexes are derived state: they may be rebuilt or safely reduced, but never become a fallback source for an inconsistent Store.
- A Store root owns Pack data and derived indexes. Model configuration, model cache, Backend address, and runtime state do not belong to a Store-root selection.
- Preserve one consistent snapshot across candidate selection, canonical reads, and result assembly. Typed errors must distinguish empty results, stale/incompatible derived state, recovery requirements, and runtime-independent input errors.

## Retrieval and persistence work

- Keep keyword retrieval offline and independent of Backend/model lifecycle.
- Semantic use cases operate on Engine contracts and runtime adapters supplied by Backend composition. Do not introduce a reverse Engine-to-Backend-client path.
- Treat retained revision deltas as normal synchronization input. A full derived-index rebuild is recovery for initial state, corruption, unavailable history, or continuity failure—not the routine response to every Store mutation.
- Put LocalStore lifecycle, storage, schema, and query rules beside their existing functional modules. Do not move domain rules into generic `shared` merely because several Engine modules call them.

## Verification

- Add colocated tests for every Engine behavior. Use temporary Store roots and mocked filesystem/network boundaries; never access a developer Store in unit tests.
- Run focused Engine tests, then `bun test packages/engine` when the package-wide scope is affected.
- Any retrieval, index, persistence, or ranking performance claim needs the relevant benchmark and a stated measurement boundary. Read [keyword-query benchmarking](../../docs/development/keyword-query-benchmark.md) and the applicable design/ADR before changing the measured path.
- Use the current API/CLI documents for externally visible behavior; a benchmark, test fixture, or historical plan alone does not define the public contract.

## Canonical references

- [LocalStore ADR](../../docs/adr/0007-engine-local-store.md)
- [Query CLI contract](../../docs/cli/query.md)
- [Semantic Query dependency boundaries](../../docs/plans/semantic-query-v1-dependency-boundaries.md)
