## ADDED Requirements

### Requirement: Legacy baseline invalidates derived indexes
当 LocalStore 完成 legacy canonical projection baseline recovery 时，任何基于旧 projection 的 keyword 或 semantic derived index MUST 被丢弃，不得继续报告为可安全使用。后续 keyword 或 semantic index 操作 MUST 从 recovered Store snapshot 重建；semantic index 的 staging validation、snapshot fence 和 atomic publication 仍适用，且 canonical Pack commit MUST 不因 derived-index 重建失败而回滚。

#### Scenario: Semantic index is not reused after a legacy baseline reset
- **WHEN** Store 在 legacy baseline recovery 前存在 active semantic index
- **THEN** recovery 完成后该 index MUST 不再被视为 ready，且后续 build MUST 以 recovered Store snapshot 建立新的 index
