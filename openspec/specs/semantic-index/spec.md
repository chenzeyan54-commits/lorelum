# semantic-index Specification

## Purpose
为每个 LocalStore 维护可重建、可恢复的 semantic index，使 semantic retrieval 能基于固定 Profile 安全读取派生向量，同时不把索引或后台任务误当成 Pack 内容的事实来源。

## Requirements

### Requirement: Store-scoped derived index status
semantic index SHALL 绑定一个 LocalStore snapshot 和固定 embedding Profile；`--store-root` MUST 只选择 Store 及其 index，不得选择模型、模型缓存、Backend 地址或 runtime。canonical Practice MUST 保持唯一内容事实来源。`lore index status` SHALL 只读取所选 Store 的 index metadata，且 MUST 不启动 Backend、下载模型或构建 index。

#### Scenario: Read-only status
- **WHEN** 调用方对任意 Store 执行 `lore index status`
- **THEN** 命令 MUST 返回 `missing`、`ready`、`stale` 或 `incompatible` 状态之一，且 MUST 不启动模型工作

### Requirement: Build and rebuild preserve consistency
`lore index build` MUST 在 active index 已与当前 Store 和 Profile 一致时避免重复编码。Store 发生连续变更时，build SHALL 仅重新编码新增或 semantic projection 改变的 Practice；删除或仅 metadata 改变的记录 MUST 不要求 embedding。历史缺失、index 不兼容或安全复用不能证明时，build MUST 回退到完整 snapshot 构建。`lore index rebuild` MUST 强制完整构建。所有构建 MUST 在 staging index 完整校验后，受 Store snapshot fence 保护地原子发布 active index；失败 MUST 保留原 active index。

#### Scenario: Ready index is a no-op
- **WHEN** `lore index build` 发现 active index 已完整覆盖当前 Store 且 Profile 兼容
- **THEN** 命令 SHALL 返回 ready index，且 MUST 不请求 document embedding

#### Scenario: Incremental update
- **WHEN** Store 的连续 revision history 可以安全覆盖 active index 之后的变更
- **THEN** build SHALL 只编码新增或 projection 改变的 Practice，并原子发布更新后的 index

#### Scenario: Failed replacement leaves current index usable
- **WHEN** full 或 incremental 构建在 staging、embedding 或发布前失败
- **THEN** 系统 MUST 不把未完成 index 标记为 ready，且此前 active index MUST 保留

### Requirement: Legacy baseline invalidates derived indexes
当 LocalStore 完成 legacy canonical projection baseline recovery 时，任何基于旧 projection 的 keyword 或 semantic derived index MUST 被丢弃，不得继续报告为可安全使用。后续 keyword 或 semantic index 操作 MUST 从 recovered Store snapshot 重建；semantic index 的 staging validation、snapshot fence 和 atomic publication 仍适用，且 canonical Pack commit MUST 不因 derived-index 重建失败而回滚。

#### Scenario: Semantic index is not reused after a legacy baseline reset
- **WHEN** Store 在 legacy baseline recovery 前存在 active semantic index
- **THEN** recovery 完成后该 index MUST 不再被视为 ready，且后续 build MUST 以 recovered Store snapshot 建立新的 index

### Requirement: Daemon-owned index operations
`lore index build` 和 `lore index rebuild` SHALL 向 Backend 提交一个 daemon-owned operation。CLI 只在约一秒的观察预算内读取结果；ready 可直接返回，仍在执行的 operation MUST 返回 `preparing` 或 `building` 与 operation ID，已确认失败 MUST 返回 error envelope。Backend MUST 在同一 daemon 内继续已接受 operation；CLI 中断不得取消它。v1 MUST 最多同时运行一个 index operation，额外 build/rebuild MUST 返回 `backend.busy`，且不得排队。`lore index operation <id>` MUST 只读取 operation，不得启动 Backend；daemon 退出后旧 ID MUST 返回 `backend.operation-expired`。

#### Scenario: Model preparation continues the accepted operation
- **WHEN** 已接受的 index operation 首次需要 embedding 而固定模型尚未 ready
- **THEN** Backend SHALL 将同一 operation 标记为 preparing，完成模型准备后重新执行该 operation，而 CLI 超过观察预算时 MUST 返回该 operation 的 pending 状态

#### Scenario: Concurrent build is rejected
- **WHEN** 一个 Store 的 index build 或 rebuild 已在 daemon 中活跃
- **THEN** 第二个 build 或 rebuild MUST 返回 `backend.busy`，且系统 MUST 不创建后台队列

### Requirement: Pack installation does not depend on derived index success
`lore pack install` MUST 先完成 canonical Pack commit，再对同一 Store 提交普通 semantic index build。安装结果 SHALL 在 `indexSync` 中报告 `ready`、`pending` 或 `failed`；`pending` MUST 含可读取的 operation ID。派生 index 的准备、失败或取消 MUST 不回滚已成功提交的 Pack。

#### Scenario: Installation returns while index is preparing
- **WHEN** Pack 已完成 canonical commit，而其 index build 正在准备模型或构建
- **THEN** install MUST 成功返回 Pack 结果及 `indexSync.state: "pending"`，并保留可查询的 operation ID
