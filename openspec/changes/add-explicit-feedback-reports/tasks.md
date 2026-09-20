## 1. 报告合同与 trace 日志收集

- [x] 1.1 将 feedback report schema、input parser 和 Markdown renderer 改为明确的 `summary`、`detailed-log`、`input` evidence 来源，升级 schema version；通过 goldens 验证默认 report 不含 generic context，选中的原文保持本机内容并准确显示 external review。
- [x] 1.2 在 `@lorelum/log` 上实现供 feedback 使用的内部 trace collection：default summary、`info` 与 `debug` levels、shared lifecycle relation 和 missing/truncation markers；通过 same-trace/other-trace/shared-operation/corrupt-rotation/debug-missing/credential canary tests 验证。
- [x] 1.3 将 CLI `feedback draft` 扩展为 `--include-logs info|debug`，保留 input 高级模式和无网络/daemon/model/Store 副作用；通过 command schema、invalid option、source/compiled JSON envelope 和 atomic artifact tests 验证。

## 2. Agent、模板与文档

- [x] 2.1 更新 Codex/ZCode/generic Lorelum Skill guidance：长任务结束时一次性 offer、default vs detailed consent、缺少 debug 时的复现建议；通过 guidance fixture 验证 Agent 不自动读取、写入、上传或重复提醒。
- [x] 2.2 更新 bug、feature、field-feedback forms、CONTRIBUTING、CLI/site/dev docs，说明 local draft、manual public submission、maintainer triage 的区别及 detailed log 外发审阅；通过 YAML/schema、链接和命令示例检查验证。

## 3. Integrated verification

- [x] 3.1 以 bug、improvement、retrieval/Practice miss、Skill timing、Windows native exit `0`/zero-output、evidence-deficient defer fixtures 端到端验证默认与 detailed draft；确认另一 trace、完整 logs/Store/conversation/env/config 和自动 credential 均不被附带。
- [x] 3.2 运行 feedback/CLI/log/Backend/config/Plugin focused tests、`bun test`、`bun run typecheck`、`bun run lint`、`bun run build:cli`，以及两个 change 的 strict OpenSpec validation；记录因 native artifact/platform 导致的任何验证限制。
  - 验证边界：默认草稿对 Windows native `exitCode: 0`/zero-output 的报告形状由 fixture 覆盖；真实 Windows native artifact 与进程启动仍须在 Windows runner 上作为集成验收执行。
