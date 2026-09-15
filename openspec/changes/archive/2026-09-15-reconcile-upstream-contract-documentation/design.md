## Context

见 [proposal.md](./proposal.md)。上游已合入三组互不等价的材料：Pack release 文档、generic/Codex Skill 指引，以及 LocalStore 的 Drizzle persistence 与 legacy reset。现有 13 份 current specs 已覆盖 semantic 默认、`indexSync`、canonical Store 与原子 index publication，但没有 Pack selector、host retrieval flow 或 legacy baseline 的完整 owner。

当前证据如下：

| 合同事实 | 代码或测试证据 |
| --- | --- |
| 未 pin 的 Pack 选择最高稳定版本，pin 只接受精确版本 | `packages/cli/src/install/resolve-release.ts`、`resolve-release.test.ts` |
| install 遇到不同 artifact 要求显式 update，且随后报告 `indexSync` | `packages/cli/src/install/install-command.ts`、相关 install tests |
| Codex Hook 只注入 Catalog；generic/Codex Skill 与 recovery reference 定义检索时机 | `packages/cli/src/hook/codex.ts`、`docs/development/skill-guidance-fixtures.md`、`skills/lorelum/`、`plugins/lorelum/skills/lorelum/` |
| legacy projection 只从 manifest 与 sealed artifacts 重建，失败不毁损 Pack | `packages/engine/src/local-store/storage/sqlite/legacy-reset.ts`、`storage/artifacts/rebuild.ts`、`lifecycle/recovery.test.ts` |

## Goals / Non-Goals

**Goals:**

- 让每个新增文档描述的稳定行为有唯一 current spec owner，参考文档只解释该合同。
- 将已实施的 ORM 重构推导从默认可见的 research 目录移入本 change archive，同时保留可追溯的 section-to-destination mapping。
- 保持 Pack、Skill、Plugin、CLI 和 Engine 的现有外部行为不变。

**Non-Goals:**

- 不将 Drizzle、SQLite 表结构、生成命令、文件路径或原生 SQL 例外写入产品 capability spec；这些继续由 `docs/development/persistence.md` 与 Engine scoped guidance 负责。
- 不引入本地 MCP、远程 retrieval、自动 keyword fallback、后台队列或新的 Pack release 策略。
- 不把 Skill guidance fixtures 变为自动化测试，或要求 generic 与 Codex Skill 文案逐字一致。
- 不修改先前 documentation-consolidation archive 的来源边界；本轮新 research 文档只进入本 change 的 archive。

## Decisions

### 以 observable contract 拆分，而非逐文档迁移

Pack selector、Agent retrieval flow 与 legacy recovery 分别进入 `pack-management`、`agent-integration`、`practice-read`/`semantic-index`。README、site docs、Plugin docs、Skill、recovery reference、fixtures 与 development guide 保留原有读者用途，并链接或核对对应 current specs。

不采用“每个新增 Markdown 变成 spec”：这会使 Pack 版本示例、host-specific wording、命令步骤与 Drizzle implementation choice 反过来成为不可替换的产品合同。

### 将 unpinned Pack 解析定义为最高稳定 release

`pack-management` 只规定不带 `@version` 的请求选择 Registry 内最高稳定 SemVer，精确 pin 不能 fallback，并保持 install/update 两步边界。它不记录 `agentic-coding` 的某个瞬时版本号，也不复制 `indexSync`；后者继续由 `semantic-index` 所有。

不把该规则放进 `semantic-index`：release resolution 发生在 canonical Pack commit 之前，且同样影响未触发 semantic index 的 Registry error 与 update-required 结果。

### Agent spec 约束语义，不统一宿主文案

`agent-integration` 记录 Catalog 的建立或复用、Hook metadata-only、值得检索时的 targeted semantic query、full Practice read，以及 preparing/error 的 retry 和 explicit keyword boundary。Skill 只在判断 guidance 值得检索的 material moment 适用这一路径；该规则不把每个普通编辑变成强制 query。

不修改 `plugin-distribution`：现有 Plugin runtime boundary 已覆盖已安装 CLI 与不持有 runtime 的限制。本轮差异是所有宿主共享的 retrieval protocol，owner 应为 `agent-integration`。

### Legacy reset 只提升数据安全语义

`practice-read` 记录 canonical reconstruction 的 authority、验证前置与不可破坏失败；`semantic-index` 记录旧 derived indexes 不可复用。已有 semantic-index requirement 继续负责 staging、snapshot fence 与 atomic publication，因此新 requirement 不重复实现机制。

不新建 `persistence` capability 或 ADR：当前可验证的稳定需求是 recovery outcome，不是 Drizzle 的长期不可替换架构承诺。若未来希望锁定 ORM，须另行提出 ADR。

### 已实施 ORM 设计进入本 change 的 archive

实施阶段为 `docs/research/local-store-orm-reassessment.md` 建立 section-to-destination mapping：

| 原始 sections | Current destination | Archive / reference destination |
| --- | --- | --- |
| LocalStore authority、snapshot、legacy baseline | `practice-read` | `docs/development/persistence.md` 的维护细节 |
| keyword/semantic derived state、publication | `semantic-index` | `docs/development/persistence.md` 的维护细节 |
| Engine/Backend ownership、locks | 已有 `backend-runtime` | current Engine scoped guidance |
| alternatives、目录草图、Drizzle API、实施顺序、deferred work | 无 | 本 change archive 的 provenance |

## Risks / Trade-offs

- [把文档示例误写成行为事实] → 每个 requirement 都以实现和测试为依据；未能佐证的文案只保留为 reference 或在 apply 前移出 scope。
- [Skill contract 变成无条件检索义务] → requirement 明确以 Skill 判断 guidance 值得检索为前提，并保留普通低风险工作不查询的边界。
- [legacy reset 导致旧 index 误被当作 ready] → current spec 要求丢弃 derived indexes，后续 build 仍走既有 staging/snapshot-fence 验证。
- [archive 再次污染 ordinary work] → research 正文在 archive 后从 `docs/research/` 删除；默认搜索继续排除 archive，ordinary work 从 current specs 开始。
- [一次 change 承担过多无关产品改变] → 此 change 只同步三类已合入的 documentation contract，不改代码或公开行为；真正行为变更必须另建 change。

## Migration Plan

1. 将四份 delta specs 与当前实现/tests 逐条复核，并在 review 后同步到 current specs。
2. 保留并校对 README、site docs、Skill/Plugin、recovery references、fixtures、`docs/development/persistence.md` 和 Engine guidance 的链接；它们不得复制或改变 spec requirements。
3. 将 ORM reassessment 的 section mapping 与原文保存到本 change archive，再删除 `docs/research/local-store-orm-reassessment.md`。
4. 验证 OpenSpec delta/current specs、Markdown links、Pack selector 与 LocalStore recovery 的 focused tests；确认 archive 默认不可见且没有 `docs/plans` 或 `docs/history` 入口复生。

回退只涉及文档/spec/archive：在同步或删除前恢复 research 原文和当前 specs，修正 coverage mapping 后重新验证；不得通过长期保留两套 current design 文档规避失败。
