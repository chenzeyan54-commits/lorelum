# diagnostic-logging Specification

## Purpose

为 Lorelum 的 CLI、Backend、Host Hook 与开发者提供可关联、可查看、可管理的本机日志，使发行版问题能够复现和定位，同时不把本机记录自动扩展成外发、上传或远程 telemetry。

## Requirements

### Requirement: Local logger is direct to use and preserves useful local context

系统 SHALL 通过内部 `@lorelum/log` workspace package 提供 `debug`、`info`、`warn`、`error` 的本机 logger。调用方 MUST 能以字符串 message 和普通 JSON context 记录新日志，并可将 Error 交给 logger 序列化；新增普通日志 MUST NOT 要求先修改全局 event union、字段类别表或单字段字节上限。logger MUST 支持可选的 `traceId`、`requestId`、`operationId`、`preparationId`、`nativeRunId` 上下文，使同一次调用及其原子节点能够关联而不把共享 operation 归属于唯一 trace。

logger MUST NOT 自动记录 authorization、cookie、Bearer token、private key、probe credential，或通过扫描环境、配置、仓库与完整 HTTP request 发现的 secret。对调用方显式给出的普通本机 context，logger MUST 不仅因为它是 query、Practice、路径、模型、原生输出或错误文本而自动脱敏、截断或拒绝；已知 credential key/value 仍必须在写入前排除。

#### Scenario: Developer records a new query-adjacent log without schema work

- **WHEN** Backend 开发者以带有 `traceId` 的 logger 写入 `info("query.completed", { query, durationMs })`
- **THEN** 该条记录 MUST 保留 message、关联 ID 和本机 context，且开发者不需要新增全局诊断事件声明；若 context 含 `authorization` 或 `cookie` 键，其值 MUST 不进入 sink

#### Scenario: Logger serializes an unhandled error locally

- **WHEN** CLI、Backend 或 Hook 将 Error 作为 `error` logger 的 error 参数提供
- **THEN** 本机记录 MUST 包含足以排障的 error 名称、message 与 stack（如果存在），并保留已有关联上下文；logger 不得因为 Error 未被上层处理而终止原业务或改变 stdout 协议

### Requirement: Trace context relates an end-to-end invocation without restricting ordinary logs

普通 CLI 调用 SHALL 在开始时创建 `traceId`，并通过受保护的 Backend transport metadata 传入同一调用链。普通 CLI JSON envelope MUST 在稳定 diagnostics metadata 中返回该 `traceId`；Hook raw stdout ABI MUST 不增加该 metadata。Backend request、operation、preparation 和 native runtime MUST 保留它们各自的 request/operation/preparation/native-run ID，并按接受、加入或因果关系关联 trace；同一共享资源的普通日志可关联多个 trace，且不得泄露另一条 trace 的 request context。

`traceId` 是关联与检索根，不是 logger 的写入许可：没有 trace 的 daemon、启动、清理或开发调试日志仍 MUST 可被记录和按 source 查看。

#### Scenario: A semantic request crosses CLI and Backend

- **WHEN** 普通 `lore query` 调用经 authenticated loopback request 进入 Backend 并触发 operation 或模型准备
- **THEN** CLI envelope MUST 返回本次 `traceId`，Backend request/operation/preparation/native 日志 MUST 可通过该 trace 与其原子 ID 追溯；另一并发 trace 的 query、error 与普通 context MUST 不被归入该 trace

#### Scenario: A Hook handles an unsupported payload

- **WHEN** `lore hook <host>` 收到不支持或畸形的 payload
- **THEN** Hook MUST 用自己的 trace 记录本机 warning/error 与足够的 debug context，stderr 保留简短 degraded 提示，stdout 仍 MUST 仅输出原有 continue envelope 并以退出码 0 返回

### Requirement: Persistent local logs cover CLI, Backend, and Hooks

CLI、Backend 与每个支持的 Host Hook SHALL 将启用等级的日志写入用户级 Lorelum 日志根目录，并按 source 与调用/运行段隔离，以避免短命令或并发 Hook 争用同一 append 文件。Backend 的长驻日志 MUST 轮转；CLI 与 Hook 的短调用日志 MUST 可按 trace 段定位。自动创建的目录与文件 MUST 为当前用户私有；保留策略 MUST 有文件/总量上限并在后续写入或显式清理时删除最旧的受管理日志。

一次 sink 写入、轮转、flush 或清理的普通 I/O 故障 MUST 禁用或跳过该 sink，且不得把已完成的 query/index/model/Hook 结果变成失败、阻止必要 cleanup 或伪造 success；不安全的日志目标、符号链接替换或越界路径 MUST 继续安全失败。日志不是 Store、operation 或 runtime 状态的事实来源。

#### Scenario: A CLI and Hook run concurrently

- **WHEN** 用户同时运行普通 CLI 调用和多个宿主 Hook
- **THEN** 每条记录 MUST 作为完整日志记录写入所属 source/trace 段，任一进程不得截断或混写另一进程的记录；Hook stdout ABI 与普通 CLI 的单行 JSON stdout MUST 不变

#### Scenario: A log sink becomes unavailable after safe startup

- **WHEN** 已通过安全预检的日志目录在运行中变得不可写或轮转失败
- **THEN** 受影响 sink MUST 停止继续写入并可在 stderr 留下有限提示，但对应业务操作仍 MUST 按原结果完成和清理；随后 `lore logs` MUST 如实表现可读取的记录或缺失范围，而不得捏造日志

### Requirement: Debug mode controls detailed local collection independently from stderr presentation

系统 SHALL 支持 `lore --debug <command>` 作为一次调用的最高详细本机日志覆盖，并支持用户配置 `logging.level: debug` 持续启用详细本机记录，使自动触发的 Hook 与后台 runtime 在发行版中也可被排障。`logging.level` MUST 至少支持 `error`、`warn`、`info`、`debug`，默认值 MUST 记录正常运行所需的 `info`、`warn` 与 `error`；单次 `--debug` 对该次 CLI 调用及其传入的 Backend request 生效，但不得永久改写配置。

既有 `--log-level` MUST 继续只选择 stderr 呈现等级，不得隐式改变持久 logger 的收集等级或用户配置。详细模式不解除 credential 自动排除、私有文件权限、留存上限或反馈外发审阅要求。

#### Scenario: A release user reproduces a Hook issue with persistent debug enabled

- **WHEN** 用户在本机配置 `logging.level: debug` 后由宿主自动运行 `lore hook <host>`
- **THEN** Hook MUST 在不改变 stdout response 的情况下记录 debug payload handling、catalog rendering 和降级原因；后续用户可用 `lore logs` 查看对应 source/trace 的记录

#### Scenario: A user requests one detailed query reproduction

- **WHEN** 用户执行 `lore --debug query ...`，而配置的持续等级不是 `debug`
- **THEN** 此次 CLI 和关联 Backend request MUST 记录 debug 级 context，命令结束后配置的持续等级 MUST 保持原值，且 `--log-level` 的 stderr 选择语义不改变

### Requirement: Users can inspect and manage their local logs through the CLI

系统 SHALL 提供 `lore logs` CLI surface，使用户能按 source、level、`traceId` 和 limit 读取受管理的本机日志，并在 JSON envelope 中得到记录、来源与明确的缺失/截断信息。系统 SHALL 提供显式的 `lore logs prune` 清理入口；它 MUST 只删除 Lorelum 管理的超出当前保留策略或用户指定范围的日志，MUST 不扫描或删除任意用户目录、Store、反馈 artifact 或运行时状态。

日志读取 MUST 不启动 Backend/model、下载模型、执行 query 或修改 Store/index/runtime；读取损坏、已轮转、缺失或不可访问文件时 MUST 返回可解释的部分结果/缺失信息，而不得把其他 source 的内容填充为匹配 trace 的内容。

#### Scenario: User views a trace after a failed CLI call

- **WHEN** 用户从 CLI envelope 复制 `traceId` 并执行 `lore logs --trace-id <traceId> --limit 100`
- **THEN** 命令 MUST 在单个 JSON envelope 中按时间返回该 trace 的可读取记录、source 和 level，并报告已轮转或不可读 evidence；它不得启动 daemon 或输出另一 trace 的普通 context

#### Scenario: User prunes retained logs

- **WHEN** 用户显式执行 `lore logs prune`
- **THEN** 系统 MUST 仅清除已由保留规则淘汰的 Lorelum 日志并返回删除统计；若没有可安全删除的受管理日志，MUST 成功返回零删除而不得触碰其他文件
