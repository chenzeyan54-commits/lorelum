## 1. 通用 logger 与 package 迁移

- [x] 1.1 建立分层的 `packages/log`，实现 context、record/error serialization、logger、sink、JSONL/stderr sink 和 reader；迁移 `@lorelum/diagnostics` workspace imports 到 `@lorelum/log`，并以 unit tests 验证任意普通 context 可记录、known credential 排除、Error serialization、record 运输层截断及 `index.ts` 仅作为 barrel。
- [x] 1.2 迁移 CLI、Backend 和 Engine 现有 diagnostics/lifecycle 调用为 source-specific child logger，保留 trace/atomic ID 关系；通过 CLI/Backend/Engine focused tests 验证不再需要全局 event union 或每字段 schema。

## 2. 本机持久日志、读取与保留

- [x] 2.1 实现安全的用户级 source/trace segment layout：Backend 连续轮转，CLI/Hook invocation segment 并发隔离；通过 private permission、symlink/unsafe target、partial write、rotation、sink I/O failure 与并发 writer tests 验证安全边界和业务 non-blocking。
- [x] 2.2 实现仅读取 managed root 的 log reader 与 retention/prune service，返回 normalized records、source、缺失和截断信息；通过 corrupt/rotated/missing/other-trace files fixtures 验证不启动 daemon、不读取任意目录且不混入其他 trace context。
- [x] 2.3 添加 `lore logs` 与 `lore logs prune` command、result schema、error mapping 及 docs；通过 source、trace、level、limit、零删除和 JSON-only stdout tests 验证可查看与安全清理。

## 3. Trace 与 debug 运行时行为

- [x] 3.1 将普通 CLI trace 及 detail override 传到 Backend request、operation、preparation 和 native runtime logger；通过语义、keyword、shared operation 与 V2 envelope tests 验证 exact trace relation、无跨 trace free-form context 和 stdout 兼容。
- [x] 3.2 扩展 config 为 `logging.level`，实现 `lore --debug <command>` 单次覆盖并保持 `--log-level` 仅控制 stderr；通过 source 和 compiled CLI tests 验证 release-compatible config、override lifetime 与 Backend detail propagation。
- [x] 3.3 将 raw Host Hook 接入持久 child logger，记录 debug payload handling、parse/catalog/render/degrade 信息且维持 continue stdout ABI；通过 Codex/ZCode success、malformed payload、Store failure 与 concurrent Hook fixtures 验证。

## 4. Feedback、文档与集成验证

- [x] 4.1 依照 `add-explicit-feedback-reports` 的更新契约，将 trace projection 分为 default summary 和显式 `info`/`debug` detailed log selection；通过 same-trace detail、other-trace exclusion、shared lifecycle facts、missing debug and credential canary tests 验证。
- [x] 4.2 编写开发者 logger 接入手册、日志目录/查看/清理指南、release debug 与 Hook 排障文档，并同步中文站点/CLI 文档；通过示例 typecheck、链接和命令 contract checks 验证。
- [x] 4.3 运行 package focused tests、`bun test`、`bun run typecheck`、`bun run lint`、`bun run build:cli`、source/compiled `lore logs` 与 Hook ABI checks，并严格验证两个 OpenSpec change；记录任何平台限定的 native runtime 验证前置条件。
  - 验证边界：在 macOS 上以 fixture 覆盖 native readiness 前 `exitCode: 0`、stdout/stderr 均为零的故障事实；真实 Windows `llama-server.exe` 进程仍须在 Windows runner 上复现，不能用当前单元测试替代。
