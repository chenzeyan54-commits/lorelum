## Purpose

为工程设计资料建立单一、可追溯的权威层级，使 Agent 和维护者能从 current capability contract 开始工作，同时只在明确需要时读取历史设计与已完成 change。

## ADDED Requirements

### Requirement: Current contract authority
仓库 SHALL 将 `openspec/specs/` 作为已接受 capability 的当前行为合同。普通工作 MUST 按当前用户任务、明确选中的 active change、current specs、未被 supersede 的 Accepted ADR、当前代码和测试的顺序取证；CLI、API、配置、开发和研究文档 MUST 说明细节或证据，而不得建立相互冲突的行为合同。

#### Scenario: Implementing a current capability
- **WHEN** Agent 或维护者需要实现、审查或验证一个已接受能力
- **THEN** 其 MUST 从对应 current spec 开始，并以当前代码/tests 核验，而不得以历史设计正文决定行为

### Requirement: Historical design isolation and complete migration catalog
已归档的 change SHALL 仅保存历史、被替代和未采纳的设计证据，且 MUST 不作为普通实现依据。每份被删除的 legacy design document MUST 在本次 archive 的 source coverage matrix 中标明其 current spec、ADR/reference 或 archive destination；仓库 MUST 不再在 `docs/plans/` 或 `docs/history/` 保留该等设计正文或短入口。

#### Scenario: Auditing a removed design document
- **WHEN** 维护者需要追溯已删除的设计文档
- **THEN** 其 MUST 能在 OpenSpec archive 的 source coverage matrix 找到该文档及其每个主要 section 的去向，并显式选择 archive 路径读取历史材料

#### Scenario: Default repository exploration
- **WHEN** Agent 使用默认文件搜索探索当前工程
- **THEN** historical OpenSpec archive MUST 被默认搜索排除，而 current specs、active changes、ADR 和现行参考文档 MUST 仍可发现
