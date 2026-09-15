# Skill guidance fixtures

Use these scenarios to review the observable behavior of Lorelum's generic and Codex Skills. They validate the public retrieval contract without requiring the two host-specific Skill documents to use identical wording.

[Agent integration](../../openspec/specs/agent-integration/spec.md) owns the host retrieval flow. [Retrieval query](../../openspec/specs/retrieval-query/spec.md), [local model runtime](../../openspec/specs/local-model-runtime/spec.md), and [semantic index](../../openspec/specs/semantic-index/spec.md) own the CLI readiness and recovery states exercised below.

## Generic Skill: Catalog already in context

**Given:** the current task context already contains a usable `lore pack list --details` result.

**When:** the Agent reaches a material design decision where installed guidance may help.

**Expected:** reuse the Catalog without another list, issue one targeted natural-language semantic query, then read each Practice it will use with `lore get <practice-id>`.

## Generic Skill: Catalog absent

**Given:** a new engineering task has no Pack Catalog in its context.

**When:** the Agent begins the task.

**Expected:** run `lore pack list --details` once, retain that Catalog for the task, and do not list again before ordinary edits, commands, or replies.

## Codex Skill: Hook-injected Catalog

**Given:** SessionStart injected an Installed Pack Catalog that includes each listed Pack's `packRoot` but no resource list or Practice body.

**When:** the Agent reaches a material decision.

**Expected:** reuse the injected Catalog, including a Pack root when that Pack context is already clear; do not rerun `lore pack list --details`, issue a targeted natural-language semantic query, then read any Practice it will use in full. For a resource link on a selected Practice, preserve the matching source root rather than silently choosing another Catalog entry.

## Semantic preparation

**Given:** the initial semantic query returns `data.state: "preparing"`.

**Expected:** do not treat this as an empty result and do not switch to keyword mode. Read the relevant recovery reference only now, follow the preparation path, then retry the same semantic query.

## Explicit keyword lookup

**Given:** the user explicitly requests offline lexical lookup or semantic-runtime diagnosis.

**Expected:** use `lore query "idempotency key database uniqueness safe retry" --mode keyword`, identify the result as keyword retrieval, and do not present it as semantic retrieval.

## Unrelated low-risk work

**Given:** the Agent makes an ordinary low-risk edit or response without a material engineering decision.

**Expected:** do not run a query merely because Lorelum is available.
