## Context

本 change 的动机与范围见 [proposal.md](./proposal.md)。当前工作树有三份 current OpenSpec specs，却仍有 21 份原始设计散落在 `docs/plans/` 与 `docs/history/plans/`：6 份是完整历史正文、6 份是指向历史正文的短入口、其余 9 份仍混合 current engineering boundary、已完成阶段和 future proposal。删除这些文档而不迁移会丢失当前约束；把正文原样塞进 current specs 则会把旧 MCP、显式模型下载、默认 keyword、未来 i18n/GSAP 或未验证发布承诺重新定义为现状。

当前实现与测试表明，下列能力已存在但尚无 current spec：

| 能力 | 当前证据 |
| --- | --- |
| Backend loopback、identity、lifecycle | `packages/backend/src/{app,runtime/supervisor,protocol}/` 及其 tests；`docs/api/backend.md` |
| canonical point read 与 keyword snapshot | `packages/engine/src/local-store/lifecycle/point-read.ts`、`packages/cli/src/get/`、`point-read.test.ts`、`store.integration.test.ts` |
| 发布安装与 native package | `scripts/release/{assets,compile-cli,install*}.ts` 及 integration tests |
| native artifact/cache | `packages/backend/src/runtime/native/embedding/`、`scripts/native/{cache-paths,cache-store}.ts` 及 tests |
| Plugin marketplace | `.agents/plugins/marketplace.json`、`plugins/lorelum/`、`marketplace-config.test.ts` |
| UI 与 site structure | `packages/ui/`、`apps/site/src/{features,shared,vendor}/`、各 scoped `AGENTS.md` |

## Goals / Non-Goals

**Goals:**

- 让每份原始设计的每个主要 section 都有一个明确 destination：current spec requirement、existing ADR/reference，或本 change archive 中的历史/未采纳设计记录。
- 将已确认、可观察的行为拆为 capability specs；不以旧文件名、PR 或某个临时目录作为 contract 单位。
- 彻底删除 `docs/plans/`、`docs/history/` 与依赖它们的短入口，消除当前与历史两套 design docs。
- 保留 API、CLI、configuration、ADR、development 和 research 的读者定位，并更新其链接到 current spec 或适当证据。

**Non-Goals:**

- 不修改 Runtime、CLI、Pack format、site 行为、依赖或 release workflow。
- 不把 Proposed ADR、future query roadmap、Hybrid、持久队列、remote MCP、站点 i18n 重写或 GSAP 基础设施升级为 current behavior。
- 不把 archive 当成 current contract，也不把逐字保留旧正文误称为 capability spec。

## Decisions

### 以 capability 而非旧文档一对一建立 current specs

每项 current requirement 按稳定能力归属：retrieval/index/model 使用已有三份 specs；Backend control、point read、Agent/Plugin、distribution/native 和 Web/site 使用十份新增 specs。此设计使同一规则只有一个 current owner，并避免把“第一阶段”“第二阶段”“某次 PR”变成长期产品接口。

不采用“每一份 legacy document 直接成为一个 current spec”：旧文档经常混有已替代实施细节、未采纳候选或未来门槛，原样转换会造成 specification drift。

### 以 section-to-destination matrix 保证覆盖，而非将历史写成现状

下表是本 change 的完整 source coverage matrix。`Current` 表示写入或已经存在于 `openspec/specs/`；`Archive` 表示本 `design.md` 在归档后保存的历史推导/未采纳设计；`Reference` 表示持续由 ADR、CLI/API、configuration、development 或 research 负责。每个 source document 在删除前都必须满足本表。

| 原始设计 | 主要 sections / 内容 | Current destination | Archive / Reference disposition |
| --- | --- | --- | --- |
| `automatic-local-model-provisioning-design` | Observed、自动准备、query/index/install pending、失败与 #115 | `retrieval-query`、`semantic-index`、`local-model-runtime` | 被替代 policy、观察预算和阶段推导 archive |
| `model-delivery-and-api-design` | 资源、下载恢复、HTTP/CLI、config、实施结果 | `local-model-runtime`、`backend-runtime` | 固定实现 pin、交付阶段和旧显式下载约定 archive；HTTP 细节在 API/CLI |
| `semantic-index-incremental-build-design` | 增量、staging、恢复、CLI、deferred | `semantic-index` | index-only 阶段与 delayed work archive |
| `semantic-query-v1-dependency-boundaries` | 包依赖、runtime path、责任与目录 | `backend-runtime`、已有 retrieval/index/model specs | v1 推进顺序 archive |
| `semantic-query-v1-design` | default、profile、query/index、数据、接口、deferred | 已有 retrieval/index/model specs | 固定算法细节和未采纳 Hybrid/remote/multi-profile archive |
| `openspec-migration-design` | 现状问题、文件职责、首批迁移、治理与验收 | `documentation-governance` | 2026-09-14 试点推导 archive |
| `repository-guidance-hierarchy-design` | root/scoped AGENTS 发现结构、局部覆盖、plans 索引和检查器建议 | `documentation-governance`、root/scoped `AGENTS.md` | 该文件明确标为被替代；递归继承、局部覆盖与 `docs/plans` 索引方案未成为 current rule，保留本条作为其历史去向 |
| `agent-integration-scope` | CLI-first、Plugin scope、MCP exclusion、future gate | `agent-integration` | 无独立 legacy remainder |
| `host-plugin-distribution-design` | identity、边界、安装、维护者开发、deferred | `plugin-distribution` | 实施阶段/Issue 记录 archive |
| `cli-distribution-design` | archive、installer、byte binding、draft、ownership | `cli-distribution` | 发布实施顺序和人工发布 gate archive |
| `local-backend-service-design` | 目录、可见行为、身份、进程/data boundary | `backend-runtime` | B1 阶段、已替代 keyword-only 假设 archive |
| `local-backend-stage-2-design` | resource/config、调用、私有进程、CLI、验收 | `backend-runtime`、`local-model-runtime`、`native-runtime-artifact` | 旧显式 load/start、CPU implementation detail archive |
| `local-store-read-and-query-foundation` | read cost、point read、snapshot、CLI、QueryService、index evolution、MCP | `practice-read`、已有 `retrieval-query` | request-local FTS5、MCP 双入口和早期阶段 archive |
| `native-runtime-artifact-boundary-design` | structure、module contract、target、deferred | `native-runtime-artifact` | 实施目录变迁 archive |
| `native-development-cache-design` | location、key、build/materialize、concurrency、trust | `native-development-cache` | implementation rollout archive |
| `design-infrastructure` | ownership、tokens、package、shadcn、verification、deferred | `web-design-system` | Storybook/compiler/landing redesign 等未采纳方案 archive |
| `site-feature-architecture` | layout、dependency, Landing/Docs, SSR, verification | `site-feature-architecture` | i18n/GSAP proposed stages、future product modules archive |
| `query-implementation-design` | 早期 profile/mode/hybrid 规划 | 已有 retrieval/index/model specs | 全文为历史否定与 future context archive |
| `query-roadmap` | 已交付、运行体验、future #115/#85/#126/#127 | 已有 retrieval/index/model specs | roadmap 与 evidence gates archive；未来项获得批准后才新建 change |
| `local-backend-runtime-coordination-design` | legacy local-only coordination | 已有 retrieval/index/model specs | 全文历史 archive |
| `index-runtime-and-install-sync-design` | legacy synchronous install/index coordination | `semantic-index`、`local-model-runtime` | 全文历史 archive |

六份历史入口文件不再单独拥有内容；它们与对应完整正文一起被删除。上表没有将 API/CLI/ADR/research/development 当作 source design：它们继续拥有协议细节、决策理由、研究证据和工作流，不被重复搬入 specs。

### 以 archive 保存历史和未批准内容，并保持默认不可见

完成 implementation 后，本 change 通过 `openspec archive` 同步十份 delta specs，并将此 matrix 与历史/未采纳内容保留在 archive `design.md`。`.rgignore` 继续排除 `openspec/changes/archive/`，所以普通 Agent 不会默认搜索到旧架构；显式 provenance 调查仍可读取 archive，并必须交叉核对 current specs、ADR、代码和 tests。

不采用 `docs/history/`：它仍是第二套 Markdown design 体系，且需要额外搜索隔离和链接维护。

### 站点和 roadmap 只登记已确认部分

`web-design-system` 和 `site-feature-architecture` 仅记录已由当前目录、scoped AGENTS、tests 或 build contract 支持的 ownership 与 SSR 规则。site i18n 替换、GSAP 基础设施重写、页面 redesign 和未来产品 feature modules 只在 archive matrix 中保留为 Proposed；query roadmap 的 future #115/#85/#126/#127 同理。它们不会因为完成本次文档迁移就成为 current requirement。

## Risks / Trade-offs

- [某个 legacy section 没有去向] → 删除前逐行审查 matrix，检查 21 个原始设计均有 current/archive/reference destination。
- [历史约定重新污染实现] → archive 默认搜索排除；current specs 不包含 legacy MCP、default keyword、旧显式模型下载或未批准 future work。
- [删除 plans 后断链] → 全仓 Markdown relative-link check、`rg docs/plans|docs/history` 和 scoped AGENTS/Plugin/ADR/research 复核。
- [把实现 pin 写成公开行为] → spec 只写 target、integrity、lifecycle 与用户可见恢复行为；路径、hash、具体构建命令保留 reference 或 archive。
- [把结构有效误报为内容正确] → 分开报告 OpenSpec structural validation、source coverage review、link validation 和已有代码/test evidence。

## Migration Plan

1. 创建十份 delta specs，并将 existing retrieval/index/model specs 作为 source destinations，而不改变它们的已接受 requirement。
2. 对照本 matrix 审查每份 source 的 headings，更新 API/CLI/ADR/research/development/Plugin/scoped AGENTS 到对应 current spec 或 stable reference。
3. 删除 `docs/plans/` 与 `docs/history/`，更新 docs index 和 `.rgignore`，确保 archive 是唯一历史 design 位置。
4. 执行 strict OpenSpec validation、全仓相对链接检查、source-path absence check、format/diff/sensitive scan，以及与文档合同有关的 targeted tests；在所有任务完成后 archive change 并确认十份 specs 已同步。

回退只涉及文档：若 coverage 或链接检查失败，恢复删除前的 source 文件、修正 matrix/spec，再次验证；不得通过保留旧 plans 作为长期双重权威来规避问题。
