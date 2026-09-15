## ADDED Requirements

### Requirement: Catalog-aware targeted retrieval
CLI-first 集成的 Skill SHALL 将已提供的 Installed Pack Catalog 仅作为 routing metadata，而不得将其当成完整 Practice 内容或不存在相关 guidance 的证明。generic Skill 在任务上下文没有可用 Catalog 时 MUST 执行一次 `lore pack list --details` 并在当前任务复用结果；Codex Skill 在 Hook 已注入 Catalog 时 MUST 复用它而不得重复 list。Hook MUST 保持 metadata-only，且不得自动执行 `lore query` 或 `lore get`。当 Skill 判定 material task、decision、verification、recovery 或 completion moment 值得检索时，MUST 先执行一次 targeted natural-language semantic query；准备使用某个 Practice 前 MUST 读取其完整内容。

#### Scenario: Generic Skill establishes a missing Catalog once
- **WHEN** generic Skill 的当前任务上下文没有可用的 Installed Pack Catalog，且需要检索 guidance
- **THEN** Skill MUST 只执行一次 `lore pack list --details` 建立 Catalog，并在后续普通编辑、命令或回复前复用它

#### Scenario: Codex reuses Hook-injected Catalog
- **WHEN** Codex Hook 已向当前任务注入 Installed Pack Catalog，且 Skill 到达值得检索的 material moment
- **THEN** Skill MUST 使用该 Catalog 执行 targeted semantic query，且不得重新执行 `lore pack list --details`

### Requirement: Semantic-first recovery preserves CLI semantics
Skill MUST 不因预期延迟跳过可执行的 semantic query，也不得在首次 query 前预检 Backend、model、index 或 status。`data.state: "preparing"` 或 CLI error MUST 被视为 lifecycle state 或 actionable error，而不是空结果或无相关 Practice 的证据；Skill MUST 先按对应 recovery reference 处理，再重试同一个 semantic query。keyword retrieval MUST 只在调用方明确要求 offline lexical lookup 或 semantic-runtime diagnosis 时通过 `--mode keyword` 选择，并明确标识其为 keyword result；Skill MUST 不将其作为自动 fallback。

#### Scenario: Preparing query does not fall back to keyword
- **WHEN** targeted semantic query 返回 `data.state: "preparing"`
- **THEN** Skill MUST 不返回空 guidance 或自动执行 keyword query，而必须在准备完成后重试同一个 semantic query

#### Scenario: Explicit offline lookup uses keyword mode
- **WHEN** 调用方明确要求 offline lexical lookup 或诊断 semantic runtime
- **THEN** Skill MAY 使用 `--mode keyword`，并 MUST 将结果标识为 keyword retrieval
