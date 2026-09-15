## 1. 核验并同步当前合同

- [x] 1.1 复核 `resolve-release.ts`、`resolve-release.test.ts`、`install-command.ts` 与 install tests 对 `pack-management` 的每个 scenario；确认无 pin 的最高稳定版本、精确 pin 和 update-required 均有证据后同步 delta，并运行相关 CLI tests。
- [x] 1.2 复核 Hook、generic/Codex Skill、fixtures、recovery references 与 `retrieval-query`/`local-model-runtime`/`semantic-index` 的既有合同；同步 `agent-integration` delta，并验证不会引入本地 MCP、自动 keyword fallback 或无条件 query 要求。
- [x] 1.3 复核 `legacy-reset.ts`、artifact rebuild、open/recovery lifecycle 与 recovery tests；同步 `practice-read` 和 `semantic-index` deltas，并验证合法 legacy reset、缺失 artifact 的 recovery-required，以及 derived index 不复用。
- [x] 1.4 运行 OpenSpec strict validation，确认新增 `pack-management` purpose、四份 delta 和同步后的 current specs 均结构有效。

## 2. 保持参考文档与 current specs 单向对应

- [x] 2.1 校对 README、site Pack docs、`docs/cli/packs.md` 与 `pack-management`，保留无 pin 的 latest-release 示例和精确 pin 的复现说明；验证示例、链接和 CLI contract 不互相矛盾。
- [x] 2.2 校对 generic/Codex Skill、Plugin/Hook 文档、recovery references 与 `docs/development/skill-guidance-fixtures.md`，使其分别链接或核对 `agent-integration`、`retrieval-query`、`local-model-runtime` 与 `semantic-index`，并验证 host-specific wording 没有重新定义 CLI 行为。
- [x] 2.3 保留 `docs/development/persistence.md` 与 Engine scoped guidance 为维护手册；验证其中只描述实现与开发流程，不把 Drizzle API、目录或生成命令写回 capability spec。

## 3. 归档已实施持久化设计

- [x] 3.1 为 `docs/research/local-store-orm-reassessment.md` 建立本 change 的 provenance 副本和 section-to-destination matrix；验证每个主要 section 指向 current spec、维护参考或 archive-only 历史材料。
- [x] 3.2 在 coverage matrix 与链接更新完成后删除 `docs/research/local-store-orm-reassessment.md`；验证当前 `docs/research/` 不再保留该设计正文，且 default search 只在显式 archive 调查时可见 provenance。

## 4. 交付验证与归档

- [x] 4.1 运行受影响的 Pack selector、LocalStore recovery、keyword/semantic index focused tests；记录已运行的命令和未运行的环境依赖。
- [x] 4.2 运行 current Markdown 相对链接检查、`rg` 检查已删除的 design 路径、`openspec validate --all --strict --no-interactive` 与 `git diff --check`；验证 current specs 可发现而 archive 默认被排除。
- [x] 4.3 在 current specs、文档链接、provenance 与验证全部完成后 archive change；验证 `pack-management` 已出现在 current specs，archive 仍只作历史证据。
