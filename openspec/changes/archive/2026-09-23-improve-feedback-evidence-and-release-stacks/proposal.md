## Why

当前 `feedback draft --trace-id` 默认只写入窄化后的 diagnostic facts；真正能定位问题的同 trace 调用链、普通 context 与 Error stack 反而要求额外参数才会进入草稿。这让本机排障报告无法直接回答“在哪一层、以什么参数、在哪一行失败”。与此同时，发行版 CLI 未把可读 TypeScript 调用栈作为构建契约验证，编译后错误可能退化为 bundle 或运行时内部位置。

本变更引入新的产品行为：本机 feedback draft 默认保留完整的同 trace 常规日志，并让 release CLI 的异常栈稳定还原到源 TypeScript 文件。对外分享仍然必须由用户明确决定，但普通 query、结果和路径不再被误当作本机排障时必须删除的内容。

## What Changes

- 将 `lore feedback draft --trace-id <traceId> --kind <kind>` 的默认 evidence 改为同 trace 的完整 `error`、`warn`、`info` LogRecord；保留 diagnostic facts 作为易读摘要，并包含 context、correlation IDs 与已记录的 Error stack。
- 保留 `--include-logs debug` 作为附加已记录 debug logs 的选择；`--include-logs info` 与默认结果等价，以兼容已有调用。debug record 未被原调用记录时，报告明确指出缺失，不能伪造或补回旧现场。
- 本机日志与本机 draft 只自动排除明确 credential；普通 query、Practice、结果、路径、原生输出和未处理异常是可用的本机排障证据。创建本机 draft 不因这些普通材料要求确认。
- 对外创建或更新 Issue 仍须由用户明确授权。仅当待外发内容出现 credential 或其他可识别的敏感材料时，Agent 才额外提示用户先审阅、删减或改走私发/未来工单；不把所有调用内容一概标为敏感。
- 为 `build:cli` 与 release staging/release 编译路径显式关闭 minify，并嵌入 source map；增加编译产物回归验证，断言已知异常的 stack 指向原始 `*.ts:line:column`，而非 bundle 或 `$bunfs` 位置。

## Capabilities

### New Capabilities

- `diagnostic-feedback`: 定义本机 trace draft 的默认完整证据、debug 扩展及外发审阅边界。

### Modified Capabilities

- `cli-distribution`: 发布 asset 的可读 source-mapped 调用栈与反混淆构建验证要求。
- `agent-integration`: Agent 的本机排障收集、草稿生成与对外反馈确认边界。

## Impact

- `packages/cli/src/feedback/` 的 evidence 选择、报告渲染、CLI help、JSON/text tests 与 Agent guidance。
- `packages/log` 记录的既有 credential 过滤继续作为唯一自动排除项；不新增本机内容脱敏层。
- `package.json`、release compiler 与编译产物测试；可能新增用于普通 CLI 编译的构建脚本以消除 `bun build --compile` 隐式 production/minify 行为。
- `skills/**/references/semantic-query-recovery.md`、`apps/site/content/docs/` 及 maintainer logging/build 文档。
