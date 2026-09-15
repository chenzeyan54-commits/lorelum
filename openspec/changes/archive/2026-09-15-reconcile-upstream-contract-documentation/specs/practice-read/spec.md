## ADDED Requirements

### Requirement: Legacy canonical projection recovery
当 selected LocalStore 保留 legacy SQLite projection 而没有当前 migration baseline 时，Engine MUST 只从 active manifest 和每个已验证、sealed Pack artifact 重建 canonical projection。重建成功后，Store MUST 暴露与 manifest 一致的 Pack 和 canonical Practice，并以一个新的完整 refresh 取代旧的 pending revision state；损坏的旧 journal 不得阻止此 baseline recovery。manifest、artifact digest 或 sealed projection 无法验证时，Engine MUST 返回 recovery-required，且不得删除或部分重写 canonical Pack 内容。

#### Scenario: Valid legacy Store is rebuilt from authoritative artifacts
- **WHEN** legacy LocalStore 的 manifest 与所有 active Pack artifact 可以验证，而旧 journal 无法读取
- **THEN** Engine MUST 重建一致的 canonical projection，并继续返回 manifest 中的 Pack 与 Practice

#### Scenario: Missing artifact blocks destructive recovery
- **WHEN** legacy LocalStore 引用的 active Pack artifact 缺失或无法验证
- **THEN** Engine MUST 返回 recovery-required，且不得删除现有 Pack artifact 或以不完整 projection 替换 Store
