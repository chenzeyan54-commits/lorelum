# practice-read Specification

## Purpose
为 `lore get` 和 keyword retrieval 提供一致、可恢复的 LocalStore canonical Practice 读取合同，使调用方不会读取混合快照、损坏内容或与目标无关的全库数据。

## Requirements

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

### Requirement: Legacy canonical projection recovery
当 selected LocalStore 保留 legacy SQLite projection 而没有当前 migration baseline 时，Engine MUST 只从 active manifest 和每个已验证、sealed Pack artifact 重建 canonical projection。重建成功后，Store MUST 暴露与 manifest 一致的 Pack 和 canonical Practice，并以一个新的完整 refresh 取代旧的 pending revision state；损坏的旧 journal 不得阻止此 baseline recovery。manifest、artifact digest 或 sealed projection 无法验证时，Engine MUST 返回 recovery-required，且不得删除或部分重写 canonical Pack 内容。

#### Scenario: Valid legacy Store is rebuilt from authoritative artifacts
- **WHEN** legacy LocalStore 的 manifest 与所有 active Pack artifact 可以验证，而旧 journal 无法读取
- **THEN** Engine MUST 重建一致的 canonical projection，并继续返回 manifest 中的 Pack 与 Practice

#### Scenario: Missing artifact blocks destructive recovery
- **WHEN** legacy LocalStore 引用的 active Pack artifact 缺失或无法验证
- **THEN** Engine MUST 返回 recovery-required，且不得删除现有 Pack artifact 或以不完整 projection 替换 Store

### Requirement: Keyword query remains Store-derived
keyword retrieval SHALL 在同一个 selected Store 的一致 snapshot 上建立或复用派生 index，并以 canonical Practice 组装摘要。keyword query MUST 保持离线，且 MUST 不改变 LocalStore canonical 内容或将 index 作为正文事实来源。

#### Scenario: Keyword index requires recovery
- **WHEN** keyword index 缺失、损坏或无法安全复用
- **THEN** 系统 MAY 从一致 Store snapshot 重建派生 index，并 MUST 仍以 canonical Practice 返回结果
