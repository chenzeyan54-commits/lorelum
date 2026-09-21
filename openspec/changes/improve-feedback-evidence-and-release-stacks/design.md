## Context

见 proposal.md 的动机。当前实现已提供通用 `@lorelum/log`、trace correlation、credential-key 过滤和 JSONL 读取，但 `packages/cli/src/feedback/command.ts` 只有在传入 `--include-logs` 时才调用 `readTraceLogs`；默认只把 `packages/backend/src/diagnostics/trace-projection.ts` 的窄摘要交给 `reportFromTrace`。该 projection 以丢弃普通 context 为设计目的，故不能作为默认本机排障证据。

当前 `packages/log/src/context.ts` 已仅过滤明确 credential，并保留 query、路径、原生输出与 Error stack；这符合本变更的本机边界。`packages/cli/src/feedback/report.ts` 则在 Markdown 中将 correlation IDs 重新编号，且把 detailed logs 视为特殊选择内容，需要调整为“本机完整证据”和“外发授权”两件不同的事。

`package.json` 的 `build:cli` 直接调用 `bun build --compile`。当前 Bun CLI 将 `--compile` 视为 production 路径，因此不能依赖隐式默认值来保证不 minify 或保留 source map。release compiler 的常规路径通过 `Bun.build({ compile })` 编译；Windows 兼容路径直接以 CLI compile 原始 TypeScript entrypoint。两条路径都以同一个仅供编译替换的 TypeScript 常量静态嵌入 staged native manifest，不依赖 plugin、banner、`process.env` 或 ESM module 初始化顺序，且不得再产生破坏 source map 的中间 bundle。现有 `scripts/release/compile-cli.test.ts` 已实际运行编译 binary，是 source-location 回归验证的合适位置。

## Goals / Non-Goals

**Goals:**

- 让一个普通 trace draft 在本机即可还原完整常规调用链，并保留可关联的原始 correlation IDs。
- 让 debug 成为“追加已记录 detail”的明确路径，而非事后声称能恢复的开关。
- 将本机证据保留、外发用户授权、以及只针对真实 credential/sensitive material 的额外审阅提示分层。
- 让开发版编译 CLI 与 release asset 都有可执行的 source-map、禁用 minify 和原始 TypeScript stack 回归保护。

**Non-Goals:**

- 不新增遥测、云端上传、Issue API、工单系统或本地 MCP surface。
- 不扫描相邻 trace，也不因为 `--include-logs debug` 重跑或重放失败调用。
- 不试图在事后补回原调用未记录的 debug detail。
- 不改变日志留存、轮转或 CLI stderr 展示层级；这些由已有 diagnostics 合同负责。

## Decisions

### 1. 默认 evidence 是完整常规 LogRecord，diagnostic facts 仅作摘要

`feedback.draft` 对 trace 输入固定读取两种相同 trace 的本机 evidence：现有 `readTraceDiagnosticFacts()` 保持简明摘要，`readTraceLogs(traceId, "info")` 成为默认完整链路。后者选择已持久化的 `error`、`warn`、`info` 直接 trace records，并追加由 correlation IDs 安全关联、但不属于其他 trace 的匿名 shared lifecycle records，因此保留日志 schema 原貌，包括调用方自由 context 和 `serializeError()` 留下的 stack。

不将 projection 扩展成万能原始日志读取器：它的职责仍是稳定诊断摘要；完整 record 的读取继续在 feedback/log reader 层完成。这样可以保持 summaries 的兼容性，也避免再次将通用 logger 收窄为 event registry。若记录已轮转、截断或不存在，reader 的 missing evidence 原样进入 report。

替代方案是改写 projection 来携带 raw context。拒绝该方案，因为 projection 的现有调用者依赖其窄、可比较的事实模型，且它会将两个不同用途耦合在 Backend diagnostics 模块。

### 2. `info` 是默认集，`debug` 是增量集

`--include-logs` 保留两种值以兼容用户脚本：未提供和 `info` 都选择常规集；`debug` 选择全部已记录级别。选择 `debug` 时，reader 独立检查是否出现过 debug 级记录；没有则加 `debug-records-not-found`，不把低级别记录误报为 debug detail。

替代方案是删除 `--include-logs info`。拒绝，因为它会无谓破坏刚引入的显式调用；等价保留不会增加维护分支。

### 3. 本机 Markdown 是完整本机视图；外发是单独的授权动作

report JSON 与 Markdown 都保留同一份本机 correlation IDs 和详细记录，以便用户从 Markdown 直接追溯 `traceId`、`requestId`、`operationId` 与 stack。`externalReview` 的语义改为“外发前需要用户审阅/授权”，而不是把普通 raw fields 定义为隐私。它继续报告 credential signals，以便 Agent 在真正需要时建议删减或私发。

自动日志过滤仍只依赖 `@lorelum/log` 的 credential key/value 规则；不新增 query、Practice、token、HTTP 或路径的 blanket redaction。对外 Issue 的实际写入仍必须由单独的用户确认驱动；当前 draft command 本身没有网络或 Issue side effect。

替代方案是为 Markdown 维护一份匿名外发版本。当前拒绝：它会再次让默认可阅读的本机报告缺失关联现场；未来有确定的 Issue/工单渠道时，可在用户授权步骤中新增显式的分享副本策略。

### 4. 所有交付编译路径显式使用 inline map 与 `minify: false`

把普通 `build:cli` 从直接 CLI compile 改为调用与 release compiler 共享的编译封装。常规 Build API 路径在 build configuration 中显式设定 `sourcemap: "inline"` 和 `minify: false`，并以 `define` 将 staged native manifest 静态替换到仅供 release compiler 使用的 TypeScript 常量。Windows fallback 直接以 Bun CLI compile 原始 TypeScript entrypoint，显式传递 `--sourcemap=inline`、`--no-minify`、同一个 `--define`、migrations 与 dotenv/bunfig 关闭参数；这避免依赖 plugin、banner、`process.env` 与 ESM module 初始化顺序。

Windows fallback 不得先产生再编译中间 bundle，因为该 bundle 会破坏运行时 stack 回到原始 TypeScript source 的映射。若 Bun 当前 CLI 不支持对 `--compile` 的显式非 minify 覆盖，实施必须以等价 Build API 路径或受支持 flag 解决，不能静默继续依赖 compile 的 production 默认值。

替代方案是只发布 external `.map` 文件。拒绝：单文件 release archive 复制/安装后容易遗漏 sidecar，且运行时 stack 无法保证读取它。inline map 让 binary 可独立还原源码位置，代价是可执行文件变大、源码信息更容易被提取；这是本变更明确接受的可调试性取舍。

### 5. 编译 binary 的 source-location test 是 release gate

在 release compiler 测试中加入受控 TypeScript fixture，编译后实际执行 executable 并断言 stack 包含该 fixture 的绝对/可识别 `.ts:<line>:<column>` source location，且不以 `.release-bundle.js` 或 `$bunfs` 作为唯一匹配。根 `build:cli` 也复用同一 compiler configuration，并执行一个轻量 built CLI smoke，保证它没有分叉成未映射的路径。

这不是为一次事故添加脆弱文本快照：source-mapped source location 与未 minify 是明确的发行产品承诺，且未来构建工具升级或 Windows fallback 改动很容易回归。

## Risks / Trade-offs

- [inline source map 增大 binary 并暴露可读源码映射] → 这是明确接受的发布可调试性成本；测试保证该成本确实产生可定位 stack，而不是只增大体积。
- [同 trace 的 info logs 比摘要大] → draft 仍限定在保留的精确 trace，用户可以在 Markdown 先看 summary；不可读/轮转 evidence 明示在 `missingEvidence`。
- [旧 consumers 将 `externalReview.required` 误读为敏感性] → 保持 JSON 字段兼容，同时更新其文案、CLI help、用户文档与 Agent reference，说明它指外发审阅而非普通本机日志的脱敏结论。
- [Bun 的跨平台 compile 行为不同] → 常规与 Windows fallback 均从同一配置常量取值，并在支持平台的 release candidate 构建中执行 binary test；不能证明的 cross target 不宣称已验证。

## Migration Plan

1. 先实现并验证共享 compiled-CLI configuration、`build:cli` 重路由，以及编译 binary 的 source-map regression test。
2. 再将 feedback 默认日志选择改为 `info`，调整 debug 缺失语义、完整本机 Markdown 和 external-review 文案，补齐 command/report/reader 回归测试。
3. 更新各宿主 recovery reference、maintainer logging guide 和中英文用户排障文档，确保 Agent 只在用户明确同意后创建 draft，且对外再单独确认。
4. 运行 change-specific tests、CLI package tests、release compiler tests、typecheck、format 与 OpenSpec strict validation；源码、binary 与文档证据都针对最终改动重新生成。

回滚只需恢复原 build script 和 feedback evidence 选择；本机已生成的完整 draft 是用户文件，不由回滚删除。
