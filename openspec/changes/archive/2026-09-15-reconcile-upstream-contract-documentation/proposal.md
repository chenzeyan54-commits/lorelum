## Why

上游新增的 Pack 安装、Skill/Hook 指引和 SQLite/Drizzle 持久化材料已经描述或依赖现有行为，但当前 OpenSpec 没有为其中三类稳定合同指定完整 owner。继续把这些事实只留在 README、Skill、开发指南和研究稿中，会重新形成可漂移的第二套行为来源；把它们逐字复制进 spec 又会把宿主措辞、Drizzle 目录与历史实施推导误写成产品契约。

本 change 只记录已合入、可由代码和 tests 核验的现状，不引入新的产品行为。

## What Changes

- 新增 `pack-management` capability，明确省略版本时的 Registry release 解析、显式 pin 和已安装 Pack 更新边界；安装后的 `indexSync` 仍由 `semantic-index` 负责。
- 扩充 `agent-integration`，定义 generic Skill 与 Codex Hook/Skill 对 Catalog、targeted semantic retrieval、`preparing`/error recovery 与显式 keyword mode 的公共边界；宿主文档可按自身语境表达，不要求文案一致。
- 扩充 `practice-read` 与 `semantic-index`，记录 legacy manual SQLite projection 的安全 baseline recovery：只从已验证 manifest 和 sealed Pack artifacts 重建 canonical Store，无法证明时返回 recovery-required，并丢弃可重建的 derived indexes 而不删除 Pack 内容。
- 将 `docs/research/local-store-orm-reassessment.md` 作为已实施持久化重构的 provenance 收入本 change archive；保留 `docs/development/persistence.md`、recovery references、fixtures、README 和 site docs 作为当前维护或用户参考，并在实施时链接到唯一 spec owner。

## Capabilities

### New Capabilities

- `pack-management`: Registry Pack release 的默认解析、显式版本选择、安装与更新边界。

### Modified Capabilities

- `agent-integration`: 为 CLI-first 的宿主集成补充 Catalog 使用、targeted semantic retrieval 与恢复语义。
- `practice-read`: 为 LocalStore canonical projection 的 legacy baseline recovery 补充可观察的保留与失败语义。
- `semantic-index`: 为 legacy baseline recovery 后 derived semantic index 的失效与安全重建补充边界。

## Impact

- 受影响的当前 specs：`agent-integration`、`practice-read`、`semantic-index`，以及新增 `pack-management`。
- 实施阶段会复核 `packages/cli/src/install/`、`packages/engine/src/local-store/`、`skills/lorelum/`、`plugins/lorelum/` 和对应 tests；不修改 CLI/API、Pack format、Backend 网络边界或 Drizzle 实现选择。
- 受影响的参考材料包括 README/site Pack 安装说明、Skill/Plugin 指引、`docs/development/persistence.md`、`docs/development/skill-guidance-fixtures.md` 与相关 recovery references。
