---
name: lorelum
description: Retrieve relevant engineering Practices from installed Lorelum Knowledge Packs before a task or decision needs them.
---

# Lorelum

Lorelum is a local retrieval layer for engineering Practices. Packs contain reusable, trigger-conditioned guidance. Use it to bring the right Practice into planning, implementation, verification, recovery, and delivery without turning it into a mandatory workflow.

## Retrieve progressively

1. If the current task could benefit from engineering guidance, make a normal natural-language query that includes the task and current work moment:

   ```sh
   lore query "I am implementing a login flow and deciding how it should integrate with the existing authentication API before coding."
   ```

2. Read the complete body of each Practice that may apply before using it:

   ```sh
   lore get <practice-id>
   ```

3. Do not query before every edit or command. Good moments include defining scope, crossing a high-risk boundary, changing a material decision, recovering after lost context, and preparing to claim completion.

4. When you need to see what is installed, refresh the Pack catalog:

   ```sh
   lore pack list --details
   ```

## Semantic retrieval is the default

Use the default natural-language path for normal work. If the local model or semantic index is preparing, wait or use the relevant model/index lifecycle command, then retry the same query.

Use keyword mode only for an intentional offline lookup or to isolate a semantic-runtime problem. Build that fallback query from concrete identifiers, paths, error text, or domain words, and state that the result is keyword retrieval:

```sh
lore query "login auth API token session" --mode keyword
```

Do not silently substitute keyword results for a failed or empty semantic query.
