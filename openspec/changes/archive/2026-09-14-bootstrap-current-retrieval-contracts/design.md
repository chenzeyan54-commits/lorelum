## Context

本 change 是首次把已交付的 retrieval query、semantic index 和本地模型 runtime 写入 OpenSpec。动机与范围见 [proposal.md](./proposal.md)。当前 `docs/plans/` 的设计文件同时包含实施前证据、已经被后续实现替代的约定和未来路线；把它们当作当前合同会使默认 keyword、显式下载前置、旧协议版本或本地 MCP 再次进入实现。

以下是本次记录的已确认运行链：

```text
lore query --mode keyword ──────────────────────────────> Engine
lore query (default semantic) ─> Backend client ─> daemon ─> Engine semantic query
lore index build/rebuild ──────> Backend client ─> daemon ─> Engine semantic index
Pack commit ─────────────────────────────────────────────> Store canonical data
                                                   └──────> daemon index operation
```

Engine 保有 Store snapshot、canonical Practice、index build/rebuild、候选验证和结果组装；Backend 保有模型准备和 daemon-lifetime index operation；CLI 解析选项、选择执行路径并输出 JSON envelope。固定模型与 runtime 是用户级资源，Store 和派生 index 则由 `--store-root` 选择。`packages/mcp` 是非产品 scaffold，当前本地集成仍是 compiled CLI + host Skill + Hook。

本次代码与测试证据包括：

| 当前行为 | 证据 |
| --- | --- |
| default semantic、keyword 直连 Engine、输入先于 Backend 验证 | `packages/cli/src/query/query-command.ts`；`packages/cli/src/query/query-command.test.ts` |
| partial coverage 排除变更 Practice；空或全排除 index 不调用 embedding | `packages/engine/src/query/semantic/query-service.ts`；`query-service.test.ts` 中相应测试 |
| build 的 no-op、增量/完整回退、staging 验证、snapshot fence 和保留旧 active index | `packages/engine/src/query/semantic/index/service.ts`；`service.test.ts` |
| 单一 index operation、缺模型后以同一 ID 继续 | `packages/backend/src/modules/index/operation-service.ts`；`operation-service.test.ts` |
| 约一秒仅是前台观察预算 | `packages/backend/src/coordination/index-runtime-client.ts`；`model-observation.test.ts` |
| 固定 artifact、partial 续传、验证和 explicit config failure | `packages/backend/src/models/prepare.ts`；`prepare.test.ts` |
| unload 不得在旧 runtime/in-flight request 存在时虚报成功 | `packages/backend/src/modules/embedding/service.ts`；`service.test.ts` |
| Backend 协议版本与路由前缀独立 | `packages/backend/src/protocol/constants.ts`（协议为 3，路由前缀为 `/internal/v1`） |

## Goals / Non-Goals

**Goals:**

- 用三个独立 capability specs 表达当前、可观察、已由代码和测试核对的合同。
- 将旧设计正文保留为可追溯资料，但让 ordinary implementation 默认从当前 spec、有效 ADR、代码和测试开始。
- 让文档导航能够区分当前接口参考、有效计划、历史推导与 OpenSpec archive。
- 用一次 repo-local OpenSpec change 完成文档迁移，并将已审阅 delta 同步为当前 specs。

**Non-Goals:**

- 不改变 Runtime、CLI、Pack format、公共 API、发布流程或任何既有行为。
- 不将 Proposed ADR 0004、0011、0014 变成 Accepted，也不把 roadmap/Issue 变成当前合同。
- 不创建私有 Spec 仓库、商业知识库或本地 MCP surface；公开仓库只保留已发布/已实现的公共能力合同。
- 不把 `docs/cli`、`docs/api`、`docs/configuration`、站点文档、benchmark 或 research 改造成重复的行为规范。

## Decisions

### 以三个稳定能力而非旧计划文件组织 current specs

`retrieval-query`、`semantic-index` 与 `local-model-runtime` 分别覆盖调用方可观察的查询、派生数据和模型生命周期。它们按稳定产品能力命名，不按 PR、package 或某次实施阶段命名。跨能力的内部顺序不写成独立 capability，避免把暂时的目录和编排提升为公共合同。

备选方案是把每份旧计划直接搬进 `openspec/specs`。不采用：这些计划包含被替代的前提和已完成的实施步骤，且在一次架构变化后容易与真实行为分叉。

### Current 与 history 采用显式真相切换

迁移后 `openspec/specs/` 是三个能力的当前合同；选中的未归档 change 仅描述拟议差异；Accepted 且未被 supersede 的 ADR 保留决策原因。`openspec/changes/archive/` 与 `docs/history/` 只作为历史证据，ordinary task 不应读取；需要追溯时必须再次以 current spec、有效 ADR、代码和测试核验结论。

五份旧正文移到 `docs/history/plans/`，原 `docs/plans/` 路径改为短入口。三份原本已是历史短入口的计划文件保留原位，但改链至 current spec。`docs/plans/agent-integration-scope.md` 和 `docs/plans/design-infrastructure.md` 继续保持默认可发现，因为它们分别是当前 CLI-first 集成边界和 Web 设计规则。

备选方案是删除旧设计或只依赖 `.gitignore`。不采用：删除损失必要 provenance，而 ignore 既不能消除 Git 历史，也不能让普通搜索和 Agent 知道它不具权威性。

### 默认搜索排除历史，而不是删除显式追溯能力

新增 `.rgignore` 排除 `docs/history/` 与 `openspec/changes/archive/`，降低用 `rg` 探索仓库时的旧架构噪声。文件本身保留可直接访问；AGENTS、OpenSpec config 和 docs index 均写明 authority order。不会把 `.rgignore` 当作保密控制：不得将敏感材料加入公开仓库或 OpenSpec archive。

### 文档迁移使用归档后同步，不引入仓库依赖

用户已要求将全局 OpenSpec 更新至最新版并初始化当前仓库；本 change 不添加 devDependency，也不以固定旧版本重复工具安装。完整 proposal/specs/design/tasks 写完后，按 OpenSpec apply instructions 执行文档迁移、验证、将 delta archive 到 `openspec/specs/`，最后核对同步结果。归档只说明 change 已完成，不等于 main 已合入、发布或得到未来变更授权。

## Risks / Trade-offs

- [首次登记的 spec 误写了历史行为] → 每项 requirement 绑定当前源码或测试；没有足够证据的内容留在历史正文或 future design。
- [历史移动后链接损坏] → 对迁移的 Markdown 执行相对链接检查；历史正文只允许身份头和必要链接修复，不重写当时推导。
- [archive 被 Agent 当成当前合同] → `.rgignore`、OpenSpec config、AGENTS 和 docs 导航都声明 archive/history 的非权威地位。
- [将约一秒观察预算误称为性能 SLA] → spec 仅定义短暂观察与 pending 行为，不承诺端到端下载或 build 时延。
- [全局旧命令残留造成版本歧义] → 当前 PATH 的 `openspec` 必须验证为最新版；管理员拥有的其他安装不手工删除，避免破坏 package-manager 所有权。

## Migration Plan

1. 以本 change 的三个 delta specs 记录 current contract，并用 `openspec validate` 校验结构。
2. 依 OpenSpec apply instructions 迁移五份旧设计正文到 `docs/history/plans/`，在原路径保留 current-spec 短入口；更新三个现有历史指针和未跟踪的迁移设计入口。
3. 新增 docs/history/docs 根导航与默认搜索排除；更新 AGENTS、development guide、CLI/API 参考中的 current spec 链接，保持其原有读者和职责。
4. 验证相对链接、格式、diff、敏感信息与针对性测试；只在所有任务勾选后 archive change，并检查 `openspec/specs/` 已拥有三份完整 current specs。

回退不涉及数据迁移或 runtime state：若文档导航或 history 标记有误，可在同一 PR 中恢复原路径正文并修正 OpenSpec artifacts；已归档的 change 不应作为回滚理由，当前 specs 才是恢复时需要修订的真相源。
