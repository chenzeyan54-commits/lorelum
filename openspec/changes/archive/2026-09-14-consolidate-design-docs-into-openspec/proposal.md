## Why

`docs/plans/` 与 `docs/history/plans/` 曾承载 21 份原始设计的正文或入口；其中既有已交付合同、当前工程边界，也混有过期阶段、未批准方案和未来路线。三份既有 retrieval spec 无法覆盖 Backend 控制、LocalStore point read、CLI/native 分发、Plugin、Web 设计和站点架构，导致删除旧文档会丢失约束，保留它们又会让 AI 读到过期架构。

本 change 把每份设计的内容分类为 current capability contract 或 OpenSpec archive 中的历史/未采纳设计，并在覆盖矩阵中逐段记录去向；完成后删除 `docs/plans/` 和 `docs/history/` 的旧正文。

## What Changes

- 新增覆盖当前已实现行为的 capability specs，并补齐当前三份 retrieval specs 以外的工程合同。
- 在 change design 中记录 21 份原始设计的 section-to-destination coverage matrix；历史、已替代和未批准内容随本 change archive，不进入 current specs。
- 将当前 Agent、CLI/API、开发、Plugin、UI 与研究文档的链接改为 current specs 或既有 ADR/reference，删除对 `docs/plans/`、`docs/history/` 的依赖。
- **BREAKING** 删除 `docs/plans/` 与 `docs/history/`；历史追溯改为显式读取 `openspec/changes/archive/`，普通搜索继续排除 archive。

## Capabilities

### New Capabilities

- `documentation-governance`: current spec、active change、archive、ADR 与参考文档的权威顺序，以及设计正文迁移后的唯一入口。
- `agent-integration`: CLI-first 的 Agent 集成、Skill/Hook 边界和本地 MCP 排除规则。
- `plugin-distribution`: Lorelum Codex Plugin 的唯一身份、marketplace 安装和 CLI-only 运行时边界。
- `backend-runtime`: 本地 Backend 的 loopback 控制、身份认证、生命周期与 Engine/CLI 责任边界。
- `practice-read`: LocalStore point read、canonical Practice 和一致快照的读取合同。
- `cli-distribution`: 单二进制发布包、安装器完整性校验和原子切换合同。
- `native-runtime-artifact`: native runtime 的 target、可信 manifest、开发候选与 release artifact 边界。
- `native-development-cache`: 跨 worktree 的 native 开发缓存、信任、并发与恢复合同。
- `web-design-system`: UI token、共享组件、主题与 shadcn 归属边界。
- `site-feature-architecture`: 站点 routes、features、shared、vendor 与 SSR/视觉验证的当前结构边界。

### Modified Capabilities

- 无。`retrieval-query`、`semantic-index` 和 `local-model-runtime` 已经记录当前可观察行为；本 change 只将其作为其他旧设计的 destination，不重新把历史内容写成 requirement。

## Impact

- 新增 `openspec/specs/` 下十份 current capability specs，以及本 change archive 中的完整设计来源覆盖矩阵。
- 删除 `docs/plans/`、`docs/history/` 及其短入口；更新根与 scoped AGENTS、Plugin、ADR、research、benchmark、CLI/API/development/docs 导航的链接。
- 不修改 Runtime、CLI、Pack format、站点行为、依赖、发布工作流或任何产品代码；本 change 只登记与整理已经存在的合同和历史材料。
