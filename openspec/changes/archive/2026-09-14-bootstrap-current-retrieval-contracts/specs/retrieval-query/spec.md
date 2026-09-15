## Purpose

为已安装 Practice 提供稳定、可机读的默认 semantic retrieval 与显式离线 keyword retrieval，使调用方能在不依赖过期设计文档的前提下选择、理解和恢复查询结果。

## ADDED Requirements

### Requirement: Query mode and input validation
`lore query <text>` SHALL 默认执行 semantic retrieval。调用方 MUST 使用 `--mode keyword` 明确选择 keyword retrieval；`--mode` 只能接受 `semantic` 或 `keyword`，`--top-k` 只能接受 1 至 50 的十进制正整数。命令 MUST 在连接 Backend 前验证 text、mode 和 top-k。

#### Scenario: Default semantic query
- **WHEN** 调用方执行未带 `--mode` 的有效 `lore query <text>`
- **THEN** CLI SHALL 选择 semantic retrieval，而不把它降级为 keyword retrieval

#### Scenario: Invalid input avoids Backend work
- **WHEN** text 为空白、`--mode` 非法或 `--top-k` 不在允许范围
- **THEN** 命令 MUST 返回 `usage.invalid`，且 MUST 不连接 Backend

### Requirement: Explicit offline keyword retrieval
`--mode keyword` SHALL 直接通过 Engine 查询所选 LocalStore 的派生 keyword index。该路径 MUST 不启动或连接 Backend、MUST 不加载模型，并且 MUST 不访问网络。keyword index 损坏、缺失或无法安全复用时，系统 MAY 从一致的 Store snapshot 重建它；canonical Practice 仍然是返回摘要的事实来源。

#### Scenario: Keyword query without a model
- **WHEN** Backend 未启动且本地模型缺失时，调用方执行有效的 `lore query <text> --mode keyword`
- **THEN** 命令 MUST 只执行 keyword retrieval，且 MUST 不触发模型准备或网络传输

### Requirement: Semantic retrieval uses a safe Store-scoped index
semantic retrieval SHALL 使用所选 LocalStore 与固定 embedding Profile 兼容的 active semantic index。没有可安全使用的 index 时，命令 MUST 返回明确的 semantic index 错误，并且 MUST 不静默切换到 keyword retrieval 或自行构建 index。index 与 Store snapshot 完全一致时结果 coverage MUST 为 `complete`；只有连续变更历史足以排除所有受影响 Practice 时，系统 MAY 返回 `partial` coverage。

#### Scenario: Missing or unsafe index
- **WHEN** selected Store 没有可用 index，或 index 与 Store/Profile 的关系无法安全证明
- **THEN** 命令 MUST 返回 `semantic.index-not-ready` 或 `semantic.index-incompatible`，并提示调用方显式执行 index 操作

#### Scenario: Partial coverage excludes changed Practices
- **WHEN** index 落后于 Store，但保留的连续 revision deltas 能确定受影响的 Practice IDs
- **THEN** semantic retrieval SHALL 排除每个受影响 ID，并在结果中返回 `coverage: "partial"`

#### Scenario: No eligible vector
- **WHEN** active semantic index 为空，或 partial coverage 排除了全部向量
- **THEN** 查询 MUST 返回空结果，且 MUST 不请求 query embedding

### Requirement: Query result and preparing semantics
成功的 ready query SHALL 在 stdout 输出一个 JSON protocol envelope，其中 results 只包含 Practice summary，不包含完整正文或内部 score；调用方 MUST 使用 `lore get <practice-id>` 读取 canonical Practice。ready result MUST 以 exit code 0 结束。若 semantic query 已接受共享模型准备但在短暂观察期内仍未 ready，命令 MUST 输出 `data.state: "preparing"`、preparationId 和恢复提示，且以 exit code 1 结束；它 MUST 不伪造检索结果。失败 MUST 使用 `ok: false` 的 error envelope 并以 exit code 2 结束。

#### Scenario: Model preparation remains pending
- **WHEN** semantic index 可用但固定模型的准备在观察期内未完成
- **THEN** 命令 SHALL 输出唯一的 preparing JSON envelope，exit code MUST 为 1，调用方可通过 `lore model status` 后重试

#### Scenario: Ready result is bounded and canonical
- **WHEN** semantic 或 keyword retrieval 成功完成
- **THEN** results MUST 至多包含请求的 top-k 个 summary，且每个 summary MUST 来自同一已验证 Store snapshot 的 canonical Practice
