## Context

见 [proposal.md](./proposal.md)。当前代码已验证到以下事实：

- `packages/diagnostics/src/index.ts` 将 trace、等级、全局事件 union、字段类别、字节截断、normalizer、sink 与 emitter 堆在一个约 380 行文件中；每增加日志点至少要改 union、字段表、normalizer 与测试。
- CLI 的普通路径可以生成 protocol V2 envelope 和 trace metadata，但 raw Hook 路径绕过普通 `run()`；失败只输出一行 stderr degraded 文本。Backend 私有 sink 只有 `backend.log`/rotation，feedback projection 只能读取受控 lifecycle event。
- 现有 `--log-level` 是 CLI stderr 呈现的选项；它不能承担发行版 Hook 的持续调试开关。Backend 现有 private file 安全检查与 state 文件原子写入模式可复用，但 sink 写入不应决定 daemon ready、业务结果或 cleanup。

这些观察来自 `packages/diagnostics/src/index.ts`、`packages/cli/src/main.ts`、`packages/cli/src/hook/host-hook.ts`、`packages/backend/src/runtime/private-jsonl-sink.ts`、`packages/backend/src/diagnostics/trace-projection.ts` 和其测试。本设计取代 active change 之前“所有字段必须预声明和逐字段限长”的迁移方向。

## Goals / Non-Goals

**Goals:**

- 让每个包用一个小而直接的本机 logger 写日常调试信息，而不是先设计全局 diagnostic event。
- 保留一条 CLI/Backend/Hook 调用链的 trace 关联和 shared-resource 的正确因果关系。
- 为发行版提供临时与持续 debug，且让用户不用直接翻 Backend 私有 JSONL。
- 让 feedback 能在明确请求时从同 trace 加入普通 `info/debug`，而不扫描全机或另一条调用链。

**Non-Goals:**

- 不引入远程 telemetry、OpenTelemetry exporter、crash reporting、日志 Web UI、上传服务、Issue API、本地 MCP 或新的后台日志 daemon。
- 不承诺日志 JSONL 是第三方稳定 API，不尝试用日志重建 Store/operation/runtime 状态，也不自动收集完整 env/config/repository/HTTP dump。
- 不用通用 logger 绕过 credential 安全边界；也不把“本机可保留”错误表述为“可无审阅外发”。

## Decisions

### 1. 迁移到 `@lorelum/log`，以通用 record 取代封闭的 event registry

`packages/log` 按职责拆成 `context.ts`（ID/level/context 与 credential filter）、`record.ts`（logger record 与 Error 序列化）、`logger.ts`（`createLogger`、child logger）、`sink.ts`、`sinks/jsonl.ts`、`sinks/stderr.ts`、`reader.ts` 与 `index.ts` barrel。日志 record 采用稳定 envelope：时间、level、source、message、可选关联 IDs、普通 context、可选 serialized error。source 是调用点的稳定命名，例如 `cli.query`、`backend.embedding`、`hook.codex`，而不是一个必须集中注册的枚举。

logger 在 sink 前递归过滤明确 credential key（大小写和常见分隔符不敏感）及 Bearer-like value；它不对 query、Practice、path、model、native output、普通 Error 或自由 context 施加“默认不记录”或逐字段大小限制。针对全 record 和单行 file 的**运输层上限**仍保留：超限 record 用明确的 `truncated` 标记安全截断，目的是防止文件失控，不要求开发者为每个字段登记预算。

备选方案：继续维护 `DiagnosticEvent` union 不能解决接入成本；引入 Pino/Winston/Consola 仍需要 Lorelum 自己处理关联、私有文件、Hook 与 feedback 选择，当前没有吞吐证据证明依赖/编译/flush 复杂度值得引入。

### 2. Context 是可选、可组合的；trace 是调用链根而不是日志类别

`createTraceId()` 仍在 CLI invocation 与 Hook invocation 创建。logger 的 `with()`/child context 合并 `traceId`、`requestId`、`operationId`、`preparationId`、`nativeRunId`；trace 接收关系由 Backend request/operation 处记录，而不是在共享对象上保存唯一 owner。普通 daemon startup、config 警告或开发记录没有 trace 也允许落盘。

普通 CLI `run()` 创建 trace、注册 root logger、用现有安全的 internal HTTP header 传 trace 和 per-request detail level；Backend 从 request context 建 child logger。Hook 在自己的 raw 入口创建 trace 但不加入 stdout。Keyword CLI→Engine 路径只注入 child logger interface，Engine 不依赖 Backend/CLI 文件 I/O。

### 3. 用 source/segment 文件管理多进程日志，并提供一个 CLI reader

用户级 root 新增 `logs/`。Backend 是单 daemon，使用 `logs/backend/current.jsonl` 加有限 rotation；CLI 和 Hook 是短生命周期与并发调用，使用 `logs/cli/<date>/<traceId>.jsonl`、`logs/hooks/<host>/<date>/<traceId>.jsonl` 形式的 invocation segment。所有自动创建路径由现有 private-directory helper 确保权限和 anti-symlink 行为。

Logger sink 只负责 append/rotation；`@lorelum/log` reader 接受已校验的 managed root，返回 normalized record、source、缺失/截断说明。CLI `lore logs` 作为唯一稳定浏览入口，所有输出保持普通 JSON envelope。`prune` 仅枚举 managed tree，按配置 retention 删除过期/超额文件，读写均不触发 daemon。

### 4. Debug 将“收集”与“终端显示”拆开

config 扩展 `logging.level`；默认 `info`，在 release 中可持久打开 `debug`。`--debug` 是 parse-level global option，构造一个 invocation detail override，并通过 Backend header 让同 trace 的 Backend request 同样采用 debug。`--log-level` 留在现有 stderr writer，避免原有脚本因“显示更多”意外扩大持久记录。

Hook 没有可由用户追加参数的自动 invocation，故使用 config；命令行 `lore --debug hook <host>` 仍供手动复现。debug 可以记录 Hook 输入/解析/渲染细节，但通过 logger credential filter 丢弃 secret，且只进入本机私有 logs。

### 5. Feedback 选择日志而不是反过来限制 logger

trace projection 分两层读取：默认 `summary` 只返回 error/warn、trace relation、request/operation/native lifecycle 的必要事实；`info`/`debug` 通过 `lore feedback draft --include-logs info|debug` 明确开启，且只挑选 exact trace 的普通记录。共享 resource 除去另一 trace 的 free-form context 和 raw error 后，才能作为 lifecycle fact 进入投影。报告仍是本地 artifact，包含 external-review required 清单；详细模式无法读取当时没有记录的 debug 内容，故 Agent 可在后续复现前建议用户开启 `--debug` 或 `logging.level: debug`。

### 6. 安全失败与运行时失败分层

创建日志 root、首次安全 preflight、source/segment 路径解析遇到 symlink/权限越界时给受控 error，避免泄露或写入任意位置。preflight 之后磁盘满、flush、rotation 或读取损坏只产生内存/stdio warning 并将单 sink disable；命令原本的 stdout result、exit contract、Backend cleanup 继续完成。文件 reader 永远报告证据缺口，不能改写成业务诊断结论。

## Risks / Trade-offs

- **普通 context 允许大对象** → 运输层限制单 record/文件大小、按 level/retention 自动 prune，并在 `lore logs` 显示截断；不把成本转嫁为每条日志的 schema 工作。
- **debug 会记录更多本机内容** → 默认 `info`，由用户选择临时或持续 debug；credential 仍不自动落盘，feedback 外发仍需单独审阅。
- **跨进程 logger 改动广** → 先迁移包和 adapters，再替换 lifecycle/event 调用，保持 V2 envelope 与 raw Hook fixture 回归。
- **目录读取可能遇到部分写入或已轮转** → JSONL reader 忽略最后一个不完整 line、返回 missing/truncated marker，绝不扫非 managed tree。

## Migration Plan

1. 新建 `packages/log` 模块并迁移 workspace/dependency/import，保留通过 package export 的 trace helper；删除旧 `packages/diagnostics` 目录，不保留双 package alias。
2. 将现有 CLI/Backend/Engine lifecycle diagnostic 发射点转为 child logger，同时加入 source-specific persistent sinks 和 safe reader。
3. 增加 config/CLI debug、`lore logs`，随后接 Hook raw path 与 trace-aware Backend propagation。
4. 将 feedback projection 改为 summary/detail 模式，最后更新 Skill、开发指南和 public CLI docs。
5. 以 source、compiled CLI、Hook ABI、并发 segment、sink failure、retention、trace isolation 和 debug feedback fixtures 验证；出问题可关闭 `logging.level: debug` 或删除 managed logs，不影响 canonical Store/runtime data。
