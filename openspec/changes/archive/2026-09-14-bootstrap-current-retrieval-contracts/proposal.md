## Why

Lorelum 的检索、semantic index 和本地模型运行已经有可工作的代码、测试与用户参考，但现有设计文档混合了已交付行为、实施前基线、未来路线和被替代的接口。AI 若把这些文件同等视为当前合同，可能恢复已废弃的显式下载前置、请求内 FTS5、旧协议版本或本地 MCP 路径。

本 change 首次把经过当前代码和测试核对的三项能力写入 OpenSpec。它只记录已经实现的合同，不新增产品行为。

## What Changes

- 为 retrieval query、semantic index 和本地模型/runtime 建立当前 OpenSpec capability specs。
- 将五份混合当前与历史的设计正文转入历史目录，在原路径保留简短入口；更新三份已被替代的短指针。
- 明确普通任务的读取顺序，默认排除 OpenSpec archive 与文档历史，但保留显式追溯能力。
- 保留 ADR 生命周期、CLI-first 集成边界、站点用户文档、开发指南和研究证据各自的职责。

## Capabilities

### New Capabilities

- `retrieval-query`: 已安装 Practice 的默认 semantic query、显式离线 keyword query、结果与错误语义。
- `semantic-index`: Store-scoped semantic index 的构建、增量、发布、operation 与 install 后同步合同。
- `local-model-runtime`: 用户级固定本地模型的准备、加载、取消、完整性和 Store 隔离合同。

### Modified Capabilities

- 无；仓库尚无 OpenSpec specs，本 change 的 ADDED requirements 是首次登记既有行为。

## Impact

- 新增 `openspec/specs/`、本 change 的规划与归档记录，以及 Codex 的项目级 OpenSpec skills/config。
- 更新根 `AGENTS.md`、文档导航、相关 CLI/API/development 参考和历史搜索排除规则。
- 迁移 `docs/plans/` 中五份设计正文及三份短指针；不修改 runtime 代码、Pack 格式、CLI 表面、发布流程或本地 MCP 边界。
