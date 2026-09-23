## Why

Lorelum 已经收到真实用户问题，但现有排障依赖零散的 stderr、Backend lifecycle 文件和临时 Hook 报错，开发者还必须为每一条新日志维护事件 union、字段分类和长度规则。这既不利于定位跨 CLI、Backend、Hook 的调用链，也让正常的 `info`、`debug` 日志几乎无法接入。

本变更**引入新的本机日志产品能力**：让发行版用户和开发者能可靠记录、查看和按调用链收集本机日志；它不是远程 telemetry，也不把本机日志自动变成反馈或公开数据。

## What Changes

- 将内部 workspace 包由 `@lorelum/diagnostics` 迁移为 `@lorelum/log`，提供直接的 `debug`、`info`、`warn`、`error` logger API。调用方可写普通 JSON context 和 Error，不再为每条日志注册全局事件、字段类型和单字段大小。
- 保留可选的 `traceId`、`requestId`、`operationId`、`preparationId`、`nativeRunId` 关联上下文。`traceId` 串联一次用户可理解的调用链；其余 ID 描述链路内的原子节点，不能互相替代。
- 为 CLI、Backend 和每个 Host Hook 建立用户级、本机持久日志与可管理的轮转/保留策略；新增 `lore logs` 用于按 source、level、trace 和数量查看记录，并提供显式清理入口。普通 CLI envelope 和 Hook stdout ABI 保持不变。
- 新增两层调试开关：`lore --debug <command>` 仅覆盖本次调用；`logging.level: debug` 持续开启本机详细日志，供发行版中的自动 Hook 或后台 runtime 使用。既有 `--log-level` 继续只控制 stderr 呈现，不改变持久收集策略。
- 明确本机与外发边界：query、Practice、路径、模型、原生输出、未处理错误等本机调试内容不因内容类别被一律改写；logger 仍不得自动记录 authorization、cookie、Bearer token、私钥、probe credential 或从环境/配置扫描得到的 secret。系统只按已知 credential key/value 过滤，不以逐字段白名单阻止普通本机日志。
- 让 feedback 草稿默认收集同 trace 的关键 lifecycle/error 事实；用户明确选择详细报告时，才加入该 trace 已存在的普通 `info` 或 `debug` 日志。它不得跨 trace、自动上传、自动创建 Issue 或读取完整日志库。
- 补齐开发者接入、日志查看/清理、发行版 debug、Hook 排障和 Agent feedback offer 的文档及测试。

## Capabilities

### New Capabilities

- `diagnostic-logging`: 定义本机通用 logger、调用链关联、持久日志、调试开关、查看与保留，以及不可自动采集的 credential 边界。

### Modified Capabilities

- 无；Agent 的 feedback offer 合同由 sibling change `add-explicit-feedback-reports` 修改。

## Impact

- **代码**：迁移 `packages/diagnostics` 到 `packages/log`；调整 CLI、Backend、Config、Hook 和 feedback composition；新增日志读取/清理及开发文档。
- **CLI/config**：增加 `--debug`、`logging.level` 和 `lore logs`；普通命令 stdout 仍为单行 JSON envelope，Hook stdout 不增加 trace 或日志字段。
- **日志文件**：统一放在用户级 Lorelum root 下，按 source/trace 可检索并有明确轮转、保留和清理语义；日志写入故障不得伪造业务失败。
- **依赖**：不新增第三方日志库。本阶段的需求是本机结构化记录、关联、文件管理和 CLI 读取，薄层实现比再适配 Pino/Winston 等库更直接；后续只有在实测证明异步 transport 或多进程吞吐成为问题时才单独评估依赖、许可证、Bun `--compile` 与跨平台 flush。
- **兼容与信任**：内部 workspace import 是受控迁移；`--debug`、`logging.level` 和 `lore logs` 是新增公开表面。不会新增 MCP、网络上传、telemetry、Issue API 或自动反馈。
