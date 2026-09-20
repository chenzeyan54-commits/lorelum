## Why

用户、Agent 与维护者已经需要把真实 bug、检索/Practice 缺口和集成问题变成可处理的反馈，但“发现问题”不能等同于自动上传或创建 GitHub Issue。现有草稿实现又把 trace 关联误解为默认导出所有原始 evidence，无法适配通用 logger 的普通 `info/debug` 排障记录。

本变更**引入新的显式本地反馈能力**：用户可以根据一次调用链生成可审阅的本地草稿；当普通摘要不足时，用户能明确要求纳入同 trace 的详细日志。它不引入任何远程收集或自动 Issue 工作流。

## What Changes

- 保留 `lore feedback draft` 的本地、非提交式工作流，并将 trace 草稿改为两档：默认只收集关键 error/warn、关系和 lifecycle facts；`--include-logs info|debug` 由用户明确选择后，才加入同 trace、已经存在的普通 logger records。
- 草稿不得要求用户为“日志本身”重新输入 event schema 或字段清单，也不得扫描所有本机日志。详细模式只改变本次草稿读取范围，不能补录当时未打开/未产生的 debug 日志。
- 将 report schema、Markdown 渲染和外发审阅提示改为如实呈现“默认摘要”“显式选择的详细日志”和“用户 input 中直接选择的内容”三种来源；本机原文保留，离开本机前仍提示用户逐项决定。
- 更新 Agent integration：Agent 发现候选问题时不打断长任务、不读取日志、不写 artifact；在最终总结或里程碑最多一次说明候选与可用 trace，用户明确同意后才生成默认或详细本地草稿。若现场证据不足，Agent 可以建议用户使用 `--debug` 或 `logging.level: debug` 复现。
- 更新 Issue templates、CONTRIBUTING、Skill/Plugin guidance 与 feedback 文档，区分“本地草稿”“用户手动公开提交”“维护者 triage”。

## Capabilities

### New Capabilities

- `feedback-reports`: 定义显式、本地、可审阅的反馈草稿、报告来源、详细日志选择和 triage 边界。

### Modified Capabilities

- `agent-integration`: 增加 Agent 的一次性 feedback offer 与用户授权后基于 trace 的草稿流程。

## Impact

- **代码**：CLI feedback feature、`@lorelum/log` trace reader/projection、report renderer、Skill/Hook guidance 和 templates。
- **CLI**：增加 `--include-logs info|debug`；保留 `--input <file|->` 作为没有 trace 或用户显式提供 observation 的高级入口。成功仍只返回单行 JSON envelope 和本机 artifact 位置。
- **信任边界**：不增加网络、GitHub API、上传、Issue 创建、telemetry、Backend/model 启动或完整日志导出。credential 自动采集仍被禁止；用户显式输入的本机原文可留在本地草稿，但必须标示 external review。
- **依赖**：无新增第三方依赖；复用日志包的安全 managed-root reader，而不把 Backend 私有 JSONL 格式变成反馈公开接口。
