# LocalStore ORM reassessment provenance

`local-store-orm-reassessment.md` 是上游已实施 SQLite/Drizzle 重构的原始设计稿。它在本 change apply 前位于 `docs/research/`；完整正文保留在本目录，仅供 provenance 调查，不是 current contract。

## Section-to-destination matrix

| 原始 sections | Current destination | Archive / reference disposition |
| --- | --- | --- |
| 结论、Observed、Proposed 的持久化分层问题 | 无独立产品 requirement | `docs/development/persistence.md` 说明当前维护结构；历史问题与目录推导保留 provenance |
| 三个物理 SQLite 数据库、migration 生成与原生 SQL 归属 | 无独立产品 requirement | `docs/development/persistence.md` 与 `packages/engine/AGENTS.md`；不将 Drizzle 实现选择固化为 capability contract |
| semantic index staging、snapshot fence、query 组装与测试分层 | `semantic-index`、`retrieval-query` | 当前 specs 记录安全发布与查询行为；实现分层保留 provenance/reference |
| Backend lock 的接口归属 | `backend-runtime` | 现有 runtime boundary；`BEGIN IMMEDIATE` 等实现细节保留 provenance |
| Alpha baseline、legacy Store 预检、Pack 保留与 full refresh | `practice-read`、`semantic-index` | 本 change 新增的 recovery requirements |
| 实施顺序、验收细节与 Deferred | 无 | provenance only；未来变更须创建独立 active change 或 ADR |

## Relocation note

原文中唯一指向当前维护指南的相对链接已改为代码路径 `docs/development/persistence.md`，避免 change 在 archive 后因目录层级变化产生断链；除此之外，正文保持为当时的设计记录。
