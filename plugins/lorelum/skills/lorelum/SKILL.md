---
name: lorelum
description: Use Lorelum's installed Pack Catalog to discover and retrieve relevant engineering Practices for the current task or decision. Treat the catalog as a relevance hint, not complete guidance or a hard filter.
---

# Lorelum

Lorelum is an optional local retrieval layer for engineering Practices. It stores reusable guidance as discrete, trigger-conditioned Practices inside Knowledge Packs. It helps an AI coding agent bring relevant team knowledge into planning, implementation, verification, and recovery without becoming a task workflow or mandatory ceremony.

## Progressive retrieval protocol

1. Treat the injected **Installed Pack Catalog** as lightweight routing metadata, not as complete engineering guidance.
2. Use each Pack's description and declared stack scope as relevance hints. A missing description or stack scope does not prove that a Pack is irrelevant; it only leaves less routing evidence.
3. If the catalog is truncated or unavailable, do not assume omitted Packs are absent. Run `lore list packs` only when refreshing discovery would help the current task or decision.
4. When a Pack may be relevant, query with both the task goal and the current work moment, for example:

   ```sh
   lore query "I am implementing a login page and deciding how it should integrate with the existing authentication API before coding."
   ```

5. Use compact query results to select a candidate Practice. Before applying a Practice or claiming that a plan follows it, read its full content. Reuse already-read content only while it remains applicable:

   ```sh
   lore get <practice-id>
   ```

If semantic query cannot proceed because the Backend, model, or semantic index is unavailable, use one explicit keyword fallback. Derive a concise lexical query from known identifiers, error text, paths, command names, or domain terms—not the original natural-language task description—then state that the response is keyword results:

```sh
lore query "login auth API token session" --mode keyword
```

Do not use keyword fallback for an empty semantic result or unrelated failures.

## Good query moments

Consider a targeted query when:

- defining scope or an implementation plan;
- entering a high-risk boundary such as auth, data, API, state, persistence, or migrations;
- changing an earlier requirement or architectural decision;
- preparing to claim completion;
- recovering after context compaction and needing to re-ground the task.

Do not turn Lorelum into a mandatory ceremony. Do not run a query before every file edit, shell command, tool call, or turn. Re-evaluate whether to retrieve only when the task scope, risk boundary, decision, or recovery need changes materially.
