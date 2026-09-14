---
name: lorelum
description: Use Lorelum's injected Pack Catalog to discover and retrieve relevant engineering Practices for the current task or decision.
---

# Lorelum

Lorelum is an optional local retrieval layer for engineering Practices. It stores reusable, trigger-conditioned Practices inside Knowledge Packs. It helps Codex bring relevant team knowledge into planning, implementation, verification, and recovery without becoming a task workflow or mandatory ceremony.

## Use the injected Pack Catalog

Codex receives a compact **Installed Pack Catalog** from the SessionStart Hook. Treat it as lightweight routing metadata, not as complete engineering guidance or a hard filter. Use each Pack's description and declared stack scope as relevance hints.

Reuse that Catalog for the task; do not rerun `lore pack list --details` at the start because the Hook already supplies the same metadata. If the injected catalog is truncated or unavailable, do not assume omitted Packs are absent; run `lore pack list --details` only when refreshing discovery would help the current task or decision.

## Use semantic retrieval for material decisions

When the current scope, plan, high-risk boundary, verification, recovery, or completion moment is worth retrieving engineering guidance for, use this sequence. Describe the task goal, the decision currently being made, and the concrete boundary or constraint:

```sh
lore query "I am designing idempotent writes for a payment API. I need to decide whether the client or service generates the idempotency key, while preserving database uniqueness and safe retry behavior."
```

Then read the complete body of every candidate Practice you will use:

```sh
lore get <practice-id>
```

The default query is semantic. Do not skip a ready semantic query solely because of expected latency. Do not run backend, model, index, or status commands before this query. Only after the query itself returns a preparation state or an error, read [semantic query recovery](references/semantic-query-recovery.md), follow the relevant recovery path, then retry the same query. Do not silently substitute keyword results for a failed or empty semantic query; use `--mode keyword` only for an intentional offline lookup or semantic-runtime diagnosis. Do not query before every edit, command, or ordinary reply.
