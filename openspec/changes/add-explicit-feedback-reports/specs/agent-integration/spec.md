## MODIFIED Requirements

### Requirement: CLI-first local integration

本地 Agent integration SHALL 使用已发布的 `lore` CLI 加宿主原生 Skill 与 Hook。Plugin、Skill 和 Hook MUST 通过 CLI 的 list、query 与 get 合同取得内容，且 MUST 不直接读取 LocalStore、导入 Engine/Backend、复制排序或错误语义。普通 Lore CLI V2 envelope 的 `diagnostics.traceId` 提供这次调用的 trace root；Agent MUST 将其仅用于本机日志查看或后续 feedback，而不得把它当作用户身份、鉴权材料或公开分享标识。Hook raw stdout ABI 不提供该 metadata。

Agent 发现可解释的 Lorelum bug、检索/指导缺口或用户明确提出的功能缺失时，MAY 在当前任务上下文形成 feedback candidate。candidate MUST NOT 读取额外日志、写入 artifact、上传或改变产品状态。除非安全、数据丢失、授权或任务继续的 blocker 需要立即说明，Agent MUST 在主任务最终交付或用户可见里程碑合并提出至多一次非阻塞 offer；它可以说明当前用户本机可见的 query、Practice、路径、原始输出或错误事实，帮助用户判断是否值得整理，但不得将此说明隐式扩展为外发授权。

只有用户明确同意生成本地草稿时，Host Agent MAY 使用候选调用的 `traceId` 执行 `lore feedback draft --trace-id <traceId> --kind <bug|improvement>`。只有用户进一步明确要求更详细的现有本机日志时，Agent MAY 加 `--include-logs info` 或 `--include-logs debug`；Agent MUST 说明该选项只读取已记录的同 trace 日志，且 detailed artifact 仍需外发前审阅。用户拒绝或未回应时，Agent MUST 不生成草稿、不读取额外日志且不得在同一任务重复提醒。

#### Scenario: A host needs a relevant Practice

- **WHEN** 宿主 Agent 需要发现或读取 Practice
- **THEN** 集成 MUST 通过 `lore` CLI 的公开 JSON 合同完成发现、query 或 get，而不得绕过 CLI 访问内部包

#### Scenario: A long task finds a candidate bug

- **WHEN** Host Agent 在用户安排的长任务中观察到可解释的 Lorelum native runtime bug 或功能缺口，且该问题不阻止主任务继续
- **THEN** Agent MUST 继续完成主任务，并只在最终总结或一个用户可见里程碑合并提出一次本地 feedback offer；它不得在发现时收集日志、生成草稿、重复提醒或隐藏用户本机可见的相关原始事实

#### Scenario: User accepts a normal feedback offer

- **WHEN** 用户明确同意 Host Agent 将已说明的候选问题整理为默认本地草稿
- **THEN** Agent MUST 使用候选的 `traceId` 调用 default draft，并展示草稿、自动关联的摘要 evidence、external review 状态与 missing evidence；它不得自动提交或修改公共 Issue、Pack、Core、Skill、文档或 evaluation

#### Scenario: User asks for detailed existing logs

- **WHEN** 用户明确要求将同一调用的已记录 `debug` 日志加入反馈草稿
- **THEN** Agent MAY 调用 `lore feedback draft --trace-id <traceId> --kind <kind> --include-logs debug`，并 MUST 说明不会读取另一 trace、不会补录过去未产生的 debug 日志，也不会自动上传草稿

#### Scenario: User declines or ignores an Agent feedback offer

- **WHEN** 用户拒绝 Agent 的 feedback offer 或在本任务中未回应
- **THEN** Agent MUST NOT 创建草稿、读取额外诊断、上传内容或在同一任务中再次提示该候选
