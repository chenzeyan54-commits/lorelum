## Context

见 [proposal.md](./proposal.md)。当前 feedback command 已能生成本地 JSON/Markdown，但其 trace projection 固定读取 Backend 私有 lifecycle JSONL，并把 trace 关联的 query、raw error、native output、path 等全部当作默认自动 evidence。它无法读取 CLI 或 Hook 的普通日志，更无法让用户在 debug 复现后选择同 trace 的 `info/debug` 作为补充。

同时，当前 Host guidance 已具备“长任务不打断、最终再 offer”的方向，但需要把命令契约从“trace 自动导出一切”改为“default summary + explicit detail”，使 Agent 不会为了制作候选而扫描日志。日志改造的当前依据见 sibling change `add-diagnostic-logging`；这里不重新定义 logger 的存储格式或 config 行为。

## Goals / Non-Goals

**Goals:**

- 对普通用户保持一条简单的 trace 草稿命令；摘要默认足以呈现已知 lifecycle/error，不把日志选择复杂性推给每个使用者。
- 在默认摘要不够时，让用户准确选择已有同 trace `info`/`debug`，而不是只能依赖早期固定 events。
- 让 Agent 报告 bug/需求的过程不打断任务、不自动写入、不自动提交，且能提示如何取得更细复现证据。

**Non-Goals:**

- 不做 full-log export、云端上传、GitHub API、自动 duplicate/priority、持续问题监控或未授权的对话质量采集。
- 不在 report 中提供所谓“自动绝对脱敏”；本机选择保留原文，公共分享由用户审阅决定。
- 不让 feedback collector 启动 Backend 或重跑造成证据的 operation。

## Decisions

### 1. `--include-logs` 是显式的 detail scope，不是默认行为或环境开关

`lore feedback draft` 的 `--trace-id` 默认读取 `summary`：CLI envelope identity、error/warn、trace/relation 和因果 lifecycle facts。`--include-logs info` 增加 `info/warn/error`，`--include-logs debug` 增加全部级别，均仅针对 exact trace。它不改变 log retention，也不会为了“需要 debug”去重启或查询 runtime；如果 log reader 已报告缺失，report 如实呈现 missing evidence。

`--input` 保持显式高级入口：用户/Agent 可以把已决定的 observation 和原文写进版本化 input，但 draft 命令绝不主动从 prompt/history 等来源构造它。

### 2. 以通用 managed-root reader 替换 Backend 专属私有日志 projection

`@lorelum/log` 提供内部 trace collection API，不作为外部 JSONL contract。它安全列出受管理 source paths、解析 record、按 trace/level/source/limit 筛选并标出 partial/corrupt/rotated/missing。Backend lifecycle shared records 先经 trace relation 图取得关联 ID；任何属于另一个 trace 的 free-form context/error 都不进入 collection。CLI feedback composition 调用该 API，不发 HTTP、不 import Backend controller，也不要求 daemon 已运行。

报告 schema 采用 `evidence: [{ source: "summary" | "detailed-log" | "input", ... }]`；detailed-log 带 logger source/level/time/message/context/error，但不把整个 private record 文件作为附件。Markdown 清楚分段，让用户决定外发时删留哪些内容。

### 3. External review 是提示，不是本机数据处理器

logger 在写入期自动排除 known credential keys/values；feedback collector 不扫描 env/config/header 補齐秘密。本机 input 或 selected detailed record 中已存在的自由文本保持原样，可产生 credential-like warning，但 artifact 只表达 `externalReviewRequired`。这是因为本机用户需要看到真实现场；无法用规则证明任何文本适合公开。

### 4. Agent 的 offer 合并到交付时刻

Skill guidance 记录候选的 trace/observed fact，但不读取日志。任务正常结束后，Agent 一次性询问用户是否需要 default draft；用户明确说“带详细日志”时才追加 include option。若 debug 不存在，Agent 推荐下次 `lore --debug ...`（单次）或 `logging.level: debug`（自动 Hook/后台复现），不承诺旧调用可补回 debug。

## Risks / Trade-offs

- **普通日志也可能有大量 context** → default summary 保持窄；explicit detail 受 trace、level、record count 和 report transport limits约束，并显示截断。
- **跨 trace shared resource 关系复杂** → 先读取 trace relation，shared record 只输出结构/lifecycle facts；用两条并发 trace fixture 覆盖泄露风险。
- **Agent 不直接生成 Issue 会多一步** → 保留人审阅和手动提交，避免把本机证据误认为公开授权或产品改动授权。
- **已存在 reports 与新 schema 不同** → `schemaVersion` 前进，读取方只支持明确版本；旧 artifact 继续可作为历史文件，不承诺反序列化更新。

## Migration Plan

1. 更新 report schema/parser/render 及 trace collector contract，移除 trace 默认原文全量采集。
2. 接入 `@lorelum/log` reader，保留 existing input path 和 artifact atomic publish。
3. 更新 command schema、source/compiled CLI tests，随后更新 Skills、Issue templates 和 docs。
4. 回归 default/detail、debug-missing、credentials、concurrent trace、Windows no-output native fixture，以及无网络/daemon/model side effect。
