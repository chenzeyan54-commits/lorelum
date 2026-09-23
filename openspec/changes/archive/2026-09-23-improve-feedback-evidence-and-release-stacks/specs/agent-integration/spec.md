## ADDED Requirements

### Requirement: Agent recovery uses local trace evidence and preserves outbound user control
当 CLI failure 提供 trace ID 时，支持的 Agent integration SHALL 只使用该 trace 的本机 `lore logs --trace-id <traceId>` 与对应本机 draft 路径排障；它 MUST NOT 扫描其他 trace、启动额外 runtime 或把新调用结果说成原失败现场。

Agent 发现 Lorelum bug 或功能缺口时，若用户正在执行长任务，MUST 在任务完成或达到安全停点后再告知用户并询问是否创建本机 feedback draft，不得为了反馈流程打断该任务。用户明确同意创建 draft 后，Agent MUST 使用默认 trace draft，因此普通同 trace 调用链会被保留。创建或更新外部 Issue、上传日志或提交其他外部反馈前，Agent MUST 再取得用户对该外发动作的明确授权。

只有待外发材料实际出现 credential 或可识别敏感材料时，Agent MUST 额外提示用户审阅、删减或改走私发/工单；普通本机 query、结果、路径和 Error stack MUST NOT 单独触发该提示。

#### Scenario: Agent defers a feedback offer until a long task is complete
- **WHEN** Agent 在用户委派的长任务中通过同 trace 本机日志确认 Lorelum bug 或功能缺口
- **THEN** Agent MUST 先完成该任务或达到安全停点，并在最终总结中询问用户是否要创建本机 draft，而不得自动创建 Issue 或打断任务

#### Scenario: User authorizes only a local draft
- **WHEN** 用户同意为某个 trace 创建本机 draft，但没有授权任何外发
- **THEN** Agent MAY 创建该本机 draft 并展示其路径，但 MUST NOT 上传内容、创建或更新 Issue

#### Scenario: External report contains no credential signal
- **WHEN** 用户明确授权外发的材料只包含普通 query、结果、路径和 Error stack，且没有 credential 或可识别敏感材料
- **THEN** Agent MUST 执行已授权的外发流程，而不得额外把这些普通材料标为必须脱敏或强制改走私发
