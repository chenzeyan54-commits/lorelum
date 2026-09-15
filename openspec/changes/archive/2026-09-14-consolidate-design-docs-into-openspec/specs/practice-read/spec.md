## Purpose

为 `lore get` 和 keyword retrieval 提供一致、可恢复的 LocalStore canonical Practice 读取合同，使调用方不会读取混合快照、损坏内容或与目标无关的全库数据。

## ADDED Requirements

### Requirement: Canonical point read
`lore get <practice-id>` SHALL 通过 Engine 从 selected LocalStore 读取一个完整 canonical Practice。非法 ID MUST 在 Store I/O 前失败；合法但不存在的 ID SHALL 返回明确的缺失结果；已返回 Practice MUST 通过 canonical 内容、digest 与来源顺序校验。

#### Scenario: Missing or invalid Practice ID
- **WHEN** 调用方请求非法 Practice ID 或合法但未安装的 ID
- **THEN** 非法 ID MUST 在打开 Store 前返回 usage error，而合法缺失 ID MUST 返回可区分的缺失结果

### Requirement: Consistent and bounded read
point read 与 query MUST 从一致的 LocalStore snapshot 读取 canonical 数据，并在 publication recovery、活跃 writer 或重复 snapshot 变化时返回恢复/忙碌语义，而不得混合前后状态。读取一个目标 Practice MUST 不因无关 SQLite row 或无关 Pack artifact 损坏而进行全库 audit。

#### Scenario: Interrupted publication during get
- **WHEN** point read 遇到可恢复的中断 manifest publication 或活跃 journal writer
- **THEN** 系统 MUST 先安全收敛或等待，并在不能获得一致快照时返回显式 Store error，而不得返回半状态 Practice

### Requirement: Keyword query remains Store-derived
keyword retrieval SHALL 在同一个 selected Store 的一致 snapshot 上建立或复用派生 index，并以 canonical Practice 组装摘要。keyword query MUST 保持离线，且 MUST 不改变 LocalStore canonical 内容或将 index 作为正文事实来源。

#### Scenario: Keyword index requires recovery
- **WHEN** keyword index 缺失、损坏或无法安全复用
- **THEN** 系统 MAY 从一致 Store snapshot 重建派生 index，并 MUST 仍以 canonical Practice 返回结果
