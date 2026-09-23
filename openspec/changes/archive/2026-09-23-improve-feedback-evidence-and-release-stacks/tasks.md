## 1. 可读的发行版调用栈

- [x] 1.1 提取普通 CLI 与 release CLI 共用的 compiled-build configuration，显式使用 inline source map、禁用 minify，并保持 migrations、manifest override、target 与 Windows fallback；以 `scripts/release/compile-cli.test.ts` 的编译测试验证配置生效。
- [x] 1.2 将 `build:cli` 改为复用该 configuration，避免直接 `bun build --compile` 的隐式 production/minify 行为；运行 `bun run build:cli` 并执行编译后的 CLI smoke 验证。
- [x] 1.3 为编译 binary 添加受控 TypeScript 异常 fixture，断言运行时 stack 含原始 `.ts:<line>:<column>` 且不只指向 `$bunfs` 或 release bundle；运行 `bun test scripts/release/compile-cli.test.ts` 验证。

## 2. 默认完整的 trace feedback evidence

- [x] 2.1 让 trace draft 无论是否传 `--include-logs info` 都读取同 trace 的既有 `error`、`warn`、`info` records；保留 diagnostic facts 摘要，并在 `packages/cli/src/feedback/command.test.ts` 验证默认 artifact 含完整 query context 与 Error stack。
- [x] 2.2 调整 debug evidence 选择：`--include-logs debug` 仅追加已记录 debug records，未记录时写入 `debug-records-not-found`；在 `packages/cli/src/feedback/logs.test.ts` 或相邻测试覆盖两种情况。
- [x] 2.3 调整 report JSON/Markdown 为完整本机视图，保留原 trace/correlation IDs 与 detailed logs；将 `externalReview` 文案限定为外发授权/credential review，而不是本机普通证据脱敏，并通过 `packages/cli/src/feedback/report.test.ts` 验证。
- [x] 2.4 保持 advanced manual input 的显式本机证据能力，并更新 command schema/help 与 tests，验证 `--include-logs info` 的兼容等价性、无网络副作用和准确 `missingEvidence`。

## 3. Agent 和文档使用路径

- [x] 3.1 更新 generic 与各宿主 Skill 的 diagnostic recovery reference：Agent 只检查原 trace，本机 draft 需用户同意，长任务在总结时再询问，Issue/upload 另行确认；运行 `bun test packages/cli/src/feedback/agent-guidance.test.ts` 验证。
- [x] 3.2 更新中英文用户排障文档和 maintainer diagnostics/build 文档，说明默认 draft 内容、`--include-logs debug` 的限制、查看 trace logs、外发确认与 release stack 行为；检查改动链接和示例命令。

## 4. 最终验证

- [x] 4.1 运行 feedback 与 release compiler 的 focused tests、`bun test packages/cli`、`bun run typecheck`、`bun run fmt:check` 和 `bun run lint`，记录与最终代码对应的结果。
- [x] 4.2 运行 `openspec validate improve-feedback-evidence-and-release-stacks --strict`，确认所有 change artifacts 与任务状态一致。
