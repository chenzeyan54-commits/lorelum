## Purpose

定义 Lorelum 从一个本机 trace 生成可直接排障的反馈草稿，以及本机证据保留与用户决定对外分享之间清晰、可操作的边界。

## ADDED Requirements

### Requirement: Trace draft includes the complete ordinary local call chain by default
`lore feedback draft --trace-id <traceId> --kind <bug|improvement>` SHALL 从已保留且直接关联该 trace 的记录，以及由该 trace 的 correlation IDs 安全关联的匿名 shared lifecycle 记录中，默认写入全部 `error`、`warn`、`info` LogRecord。它 MUST 保留每条记录已写入的 message、source、time、correlation IDs、普通 context 与 Error stack。草稿 MAY 同时提供 diagnostic facts 作为摘要，但摘要 MUST NOT 替代完整记录。

该命令 MUST 只读取已有本机日志，MUST NOT 启动 Backend、重放调用、扫描其他 trace 或杜撰缺失 evidence。保留期、轮转或读取上限导致记录不可读时，草稿 MUST 在 `missingEvidence` 中说明该限制。

#### Scenario: A failed query creates a useful default local draft
- **WHEN** 某个 trace 已写入包含 query context 与 Error stack 的 `info`、`error` 记录，用户不传 `--include-logs` 创建该 trace 的 bug draft
- **THEN** JSON 和 Markdown 本机草稿 MUST 包含这些完整记录及其原始 trace ID，且不得只输出窄化 diagnostic facts

#### Scenario: The selected trace has incomplete retained evidence
- **WHEN** 用户创建某个 trace 的 draft，但关联记录已被轮转、截断或不存在
- **THEN** 命令 MUST 仍创建可审阅的本机草稿，并在 `missingEvidence` 中准确标明无法读取的 evidence，而不得以其他 trace 的内容补全

### Requirement: Debug feedback only adds already-recorded debug evidence
默认 draft 的 `error`、`warn`、`info` evidence SHALL 与 `--include-logs info` 等价，以保持已有显式调用兼容。`--include-logs debug` MUST 在默认 evidence 基础上追加该 trace 已记录的 debug LogRecord；它 MUST NOT 改变或重跑原调用。

#### Scenario: Debug records are available for the trace
- **WHEN** 用户以 `--include-logs debug` 创建 draft，且所选 trace 已有 debug 记录
- **THEN** 草稿 MUST 包含默认常规记录和这些 debug 记录

#### Scenario: Debug was not enabled during the original trace
- **WHEN** 用户以 `--include-logs debug` 创建 draft，但所选 trace 没有任何 debug 记录
- **THEN** 草稿 MUST 保留已有常规记录，并在 `missingEvidence` 中包含 `debug-records-not-found`，而不得把 info 记录伪称为 debug 或宣称可恢复旧 detail

### Requirement: Local evidence is preserved separately from external sharing authority
本机日志和本机 feedback draft SHALL 保留普通 query、Practice 内容、结果、路径、原生输出、普通 context 及 Error stack；系统 MUST 只自动排除明确 credential（例如 Authorization、Cookie、Bearer token、API key 或私钥）而不得把上述普通排障内容一概删除或要求本机确认。

draft 创建 MUST 只写入本机输出目录，不得上传、提交或创建/更新外部 Issue。任何对外上传、创建或更新 Issue MUST 在执行前取得用户针对该外发动作的明确授权。只有待外发材料实际含有 credential 或可识别的敏感材料时，系统或 Agent 才 MUST 额外提示用户审阅、删减或改走私发/工单；普通 query、结果和路径本身 MUST NOT 触发该额外提示。

#### Scenario: A routine local draft keeps normal debugging material
- **WHEN** trace 中包含普通 query、检索结果、绝对路径和 Error stack，且不包含明确 credential
- **THEN** 本机 draft MUST 保留这些内容，创建过程 MUST 不要求隐私确认，并标明该 draft 尚未外发

#### Scenario: An external destination is requested for credential-bearing material
- **WHEN** 用户要求把含有明确 credential 或其他可识别敏感材料的 draft 发到外部 Issue 或服务
- **THEN** 系统或 Agent MUST 在外发前请求用户审阅或选择私发/工单路径；未获明确外发授权时 MUST 不发送
