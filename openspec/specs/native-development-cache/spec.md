# native-development-cache Specification

## Purpose
为多个 worktree 复用可信 native 开发构建，减少重复编译，同时不把用户 Store、仓库目录或未验证候选变成缓存事实来源。

## Requirements

### Requirement: Private content-addressed developer cache
native developer cache SHALL 位于用户 OS cache 范围，而不得位于 LocalStore、repository、Git metadata 或产品 config 路径。cache key MUST 绑定 target、recipe、toolchain 与 schema identity，且 MUST 不包含 worktree 绝对路径；不同 target 或不可信构建输入 MUST 不共享 entry。

#### Scenario: Two worktrees share the same recipe
- **WHEN** 两个 worktree 使用相同 target、recipe、toolchain 与 schema 构建 native candidate
- **THEN** 它们 MAY 复用同一 verified cache entry，且 cache key MUST 不因 worktree 路径变化而改变

### Requirement: Verified publication and safe materialization
cache entry MUST 在临时位置构建、验证并原子发布。materialize 到 worktree 时 MUST 复制并重新验证 artifact，而不得使用 symlink；损坏、取消、失败或权限不安全的 entry MUST 被拒绝或重建，且不得静默作为 candidate 使用。

#### Scenario: Corrupt cache entry
- **WHEN** native cache entry 缺少文件、manifest 不匹配或完整性验证失败
- **THEN** 系统 MUST 丢弃该 entry 并重新构建，而不得 materialize 其内容

### Requirement: Concurrency and recovery
并发 worktree 构建同一 cache key 时，系统 MUST 让一个构建者持有共享构建权，其他调用方等待其可观察结果。失败或超时 MUST 释放可恢复状态，且不得发布半成品或永久阻塞后续构建。

#### Scenario: Concurrent cache miss
- **WHEN** 两个 worktree 同时请求不存在的相同 cache key
- **THEN** 一个调用方 MUST 构建并验证 artifact，另一个调用方 MUST 等待后复用成功结果或收到明确失败
