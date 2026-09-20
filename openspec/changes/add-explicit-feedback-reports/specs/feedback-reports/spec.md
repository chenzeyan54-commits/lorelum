## Purpose

让用户或获得明确授权的 Agent 将一次真实调用中的 bug、检索效果或指导问题整理为本地、可审阅、可分流的反馈草稿，并在需要时选择同一调用链已经记录的详细日志，而不把诊断或会话自动上传或公开。

## ADDED Requirements

### Requirement: Feedback draft generation is explicit, local, and non-submitting

系统 SHALL 通过 `lore feedback draft --trace-id <traceId> --kind <bug|improvement> [--include-logs <info|debug>] [--output <directory>]` 生成 trace-rooted 反馈草稿。没有 `--include-logs` 时，命令 MUST 只读取 trace 的关键 summary facts：error/warn、trace relation、request/operation/preparation/native lifecycle，以及必要的 CLI/version/platform metadata；它 MUST NOT 自动把所有 generic `info/debug` context、query、Practice、path、HTTP body、native output 或完整 Error dump 变成报告内容。

用户显式提供 `--include-logs info` 或 `--include-logs debug` 后，命令 MAY 分别加入该 trace 已存在的 `info`（及更严重等级）或 `debug`（及更严重等级）普通日志。它 MUST NOT 跨 trace、扫描完整日志库、环境、配置、仓库、shell history、Agent conversation、Store/index 或共享资源上属于其他 trace 的 free-form context。`--input <file|->` MAY 作为无 trace 的人工 observation、fixture 或高级导入入口；input 中的原文仅在调用方显式提供时纳入。

只有调用方显式执行 draft 命令时，系统才可以读取 summary/detail logs、input 或写入 feedback artifact；安装、query、错误、Hook lifecycle、日志记录和 Agent SessionStart MUST NOT 自动生成草稿。命令 MUST 不访问网络、创建/更新 GitHub Issue、打开包含报告内容的远程 URL、启动 Backend/model、下载、query 或修改 Store/index/runtime。成功结果 MUST 使用普通 CLI JSON envelope 返回 `state: "draft"`、本地 JSON/Markdown artifact 位置、external review 状态与 `missingEvidence`；它仅表示本地草稿完整写入，不得表述为反馈已提交、已上传或已被 triage。

#### Scenario: User explicitly creates a default bug draft

- **WHEN** 用户或获授权的 Agent 为一次失败的 Lorelum 调用执行 `lore feedback draft --trace-id <traceId> --kind bug`
- **THEN** 命令 MUST 只生成本地、可审阅的 JSON 与 Markdown 草稿，包含该 trace 的 summary evidence，并在 stdout 返回单个 `feedback.draft` envelope；同 trace 的普通 `info/debug` context、网络请求和公共 Issue 状态变化 MUST 不发生

#### Scenario: User explicitly includes detailed logs

- **WHEN** 用户以 `--include-logs debug` 生成 trace 草稿且该 trace 存在 debug records
- **THEN** JSON 与 Markdown MUST 以 `detailed-log` 来源标出所选 records、source、level 与时间，包含同 trace 的 debug/info/warn/error context，并提示其外发前审阅；另一 trace 或无关联共享 resource 的 free-form context MUST 不出现

#### Scenario: Detailed logs were not recorded

- **WHEN** 用户选择 `--include-logs debug`，但该 trace 没有可读取的 debug records
- **THEN** 系统 MUST 仍生成可用草稿并在 `missingEvidence` 说明详细日志不存在或已被轮转；它不得启动 runtime、重新执行调用或伪造 debug 记录

#### Scenario: Invalid feedback input has no partial report

- **WHEN** input、traceId、kind 或 detailed level 不符合支持的 schema
- **THEN** 命令 MUST 返回 `usage.invalid` 或受控 feedback error，且不得留下半成品 JSON/Markdown artifact、启动 runtime 或读取不在选择范围内的诊断数据

### Requirement: Report sources are minimized, preserved locally, and honestly reviewable

报告 MUST 区分 summary fact、explicit detailed log 和 explicit input 三种来源，并为每项保留 source、time、level（适用时）与 trace relation。对于 trace default summary、用户选择的 detailed logs 或显式 input 中的 query、Practice、路径、模型、原生输出、HTTP body、Error 与自由文本，系统 MUST 在本机 artifact 原样保留，不得仅因内容类别自动 redaction、删改或宣称已脱敏。

logger 及 feedback collector MUST NOT 自动读取或附带 authorization、cookie、Bearer token、private key、probe credential、来自环境/配置的 secret，或未关联/未选择的日志。工具 MAY 在本机 artifact 产生前标记调用方显式输入文本中可识别的 credential 信号，但不得替换用户主动选择的原文。任何包含原始本机 evidence 的草稿 MUST 标记 `externalReviewRequired`，列出离开本机前需由用户决定的字段类别；该标记不表示用户已同意公开或上传。

#### Scenario: Input selects a query excerpt and native-output excerpt

- **WHEN** 用户要求 Agent 将一个明确给出的 query excerpt 和一个明确给出的 native-output excerpt 放入 input draft
- **THEN** JSON 与 Markdown MUST 原样包含这两个被选择的片段并列出 external review 状态，不得读取或导出未选择的 query、native output、Practice 内容或会话文本

#### Scenario: A detailed record contains query context

- **WHEN** 用户明确选择 `--include-logs info`，且该 trace 的 info record 显式记录了 query context
- **THEN** report MUST 保留该 record 的 query context 并标示来源为 detailed-log 与 external review required；未选择 detailed logs 的 default draft MUST 不自动包含它

### Requirement: Trace log collection is bounded, causal, and resilient

报告工具 SHALL 只通过 `@lorelum/log` 的内部 managed-root reader 收集 trace-rooted summary/detail records，而不得公开 Backend 私有日志路径、JSONL 格式或完整记录对象作为对外 API。collector MUST 先以 trace root 找到直接 records，再沿 request/operation/preparation/native-run relation 读取同一 trace 的 lifecycle facts；共享 resource 只能以去除另一 trace free-form context 的关系/生命周期事实加入。

诊断缺失、轮转、损坏、版本不支持、sink disabled 或没有 detailed records 时，系统 MUST 生成可用草稿并以 `missingEvidence` 表明证据边界；它不得伪造观察、读取另一 trace 或阻止用户报告。详细模式只读取已记录日志，不能追溯性开启 debug。

#### Scenario: Windows runtime exited with no output

- **WHEN** trace summary 记录为 readiness 前 exit code `0`、stdout/stderr 均为零字节的 native-run
- **THEN** 草稿 MUST 包含 artifact identity、失败的 readiness outcome、exit code、signal 缺失和两个字节计数；模型路径、完整命令、query 或原始 native output 只有在 explicit input 或 selected detailed record 已包含时才可出现，并 MUST 标为 external review required

#### Scenario: A trace shares a native runtime with another call

- **WHEN** 被选择的 `traceId` 与另一条 trace 共用一个已启动 native runtime 或 preparation
- **THEN** draft MUST 包含该 trace 的 request、operation 和相关 lifecycle facts，但不得包含另一条 trace 的 query、Practice、普通 context、原始输出、错误或用户 observation

### Requirement: Draft artifacts are versioned, private, and safely published

每次成功草稿 MUST 在用户级私有位置或调用方指定目录内创建一个唯一 artifact directory，并以不覆盖现有用户文件的方式完整写入版本一致的 JSON 和 Markdown。默认输出位置及自动创建的 artifact 文件 MUST 使用私有权限；调用方指定目录时，系统 MUST 保护新建 artifact 不跟随不安全路径，并在无法安全写入时不覆盖目标。JSON 是后续工具读取的版本化表示，Markdown 是供人审阅和手动粘贴的展示；系统 MUST NOT 承诺重新导入用户手工编辑的 Markdown 后仍与 JSON 一致。

#### Scenario: Concurrent drafts use the same output directory

- **WHEN** 两个调用方同时选择同一 `--output` 目录生成草稿
- **THEN** 每个成功调用 MUST 获得独立 artifact directory，且任何一个调用的失败都不得覆盖、截断或声明另一个调用的草稿成功

### Requirement: Feedback categories and repository templates preserve triage boundaries

反馈草稿 MUST 区分 `bug` 与 `improvement`。每份草稿 MUST 包含 summary、observed、已验证/未验证或 missing evidence、建议 disposition（Pack、Core、Skill/Plugin、文档、evaluation 或 defer）及其非决定性性质。报告、GitHub Issue template 和 CONTRIBUTING 指引 MUST 明确：生成草稿不授权改动 Pack/Core/Skill/docs/evaluation、提交公共 Issue 或自动 triage；维护者仍须为 disposition 记录理由、证据范围和下一步。

Repository 中的 bug、feature 和 field-feedback templates SHALL 引导贡献者附上经过审阅的草稿或等效的结构化观察，并在公开前提示移除不愿披露的内容。template 预置 label MUST 只使用仓库中已确认存在的 label；未知的自动 label 不得让提交者误以为它已进入 triage 队列。

#### Scenario: Maintainer triages an incomplete improvement report

- **WHEN** 一份 improvement 草稿描述 Practice 在特定决策时刻不完整，但缺少可验证的 retrieval evidence
- **THEN** triage MUST 能将其标记为 Pack、Skill/Plugin、documentation、evaluation 或 defer，并说明缺少的证据；它不得将该草稿直接视为 ranking 质量结论或自动改动内容

#### Scenario: Contributor opens a public issue from a draft

- **WHEN** 贡献者决定将本地草稿手动粘贴到 GitHub bug、feature 或 field-feedback template
- **THEN** template MUST 提示其逐项决定是否公开 query、Practice、native output、环境、路径与自由文本，并审阅可能的 credential；Lorelum CLI/Agent MUST 不因草稿生成而自动创建、更新或链接公共 Issue

### Requirement: Feedback offers are non-collecting and deferrable

Agent MAY 在当前任务中形成一个可解释的 feedback candidate，并在任务最终交付或用户可见里程碑提出一次 offer。candidate 和 offer MUST NOT 读取额外日志、创建 feedback artifact、调用网络或改变运行时；它们与已生成 draft、用户公开提交和维护者 triage 是不同状态。长任务中的 offer MUST 默认延后，不得中断仍可继续的主任务；用户明确同意后，Agent 才可以以已说明的 trace 调用 default draft。只有用户也明确要求详细现有日志时，Agent 才可加 `--include-logs`。用户拒绝或未回应时，Agent MUST 不重复 offer 或生成草稿。

#### Scenario: An Agent offers a feature-gap draft after completing work

- **WHEN** 用户在任务中明确表示 Lorelum 缺少某项能力，且 Agent 已完成该任务的主要交付
- **THEN** Agent MAY 在最终总结中一次性说明该功能缺口及本机原始上下文，并询问是否生成 local draft；在用户同意前，它不得写入、收集、上传或创建 Issue
