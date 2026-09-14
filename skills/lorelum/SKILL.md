---
name: lorelum
description: Discover installed Lorelum Knowledge Packs, then retrieve relevant engineering Practices before a task or decision needs them.
---

# Lorelum

Lorelum is a local retrieval layer for engineering Practices. Packs contain reusable, trigger-conditioned guidance. Use it to bring the right Practice into planning, implementation, verification, recovery, and delivery without turning it into a mandatory workflow.

## Establish the Pack Catalog once

At the start of each new engineering task, first check whether the current context already includes an installed Pack Catalog for this task. If it does, reuse it. If it does not, discover the installed Packs and their routing metadata once:

```sh
lore pack list --details
```

Use each Pack's description and declared stack scope as relevance hints, not as complete guidance or a hard filter. Keep this catalog for the task; do not rerun it before every edit, command, or ordinary reply. Refresh it only when the task scope changes materially, the Store may have changed, or discovery output was incomplete.

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
