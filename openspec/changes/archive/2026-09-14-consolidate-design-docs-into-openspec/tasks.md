## 1. 完成 source coverage 基线

- [x] 1.1 对照 21 份原始设计的 headings 审查 `design.md` source coverage matrix；以每份 source 都存在 current spec、archive 或稳定 reference destination 验证无遗漏。
- [x] 1.2 运行 `openspec validate --all --strict --no-interactive` 验证十份 delta specs 的结构，并人工核对不把 legacy MCP、旧默认值或 future roadmap 写成 current requirement。

## 2. 迁移 current capability 入口

- [x] 2.1 更新根/scoped AGENTS、docs index、CLI/API/development、Plugin、ADR、benchmark 与 research 链接到对应 current spec 或稳定 reference；以全仓 relative-link check 验证没有断链。
- [x] 2.2 更新 `.rgignore` 和 documentation-governance 导航，使 archive 默认不参与普通搜索而 current specs 可发现；以 `rg --files` 和 `rg --files --no-ignore` 对照验证。

## 3. 删除 legacy design 文档

- [x] 3.1 在 coverage matrix 与引用更新完成后，删除 `docs/plans/` 的全部 Markdown 设计正文与短入口；以 `rg --files --no-ignore docs/plans` 为空验证。
- [x] 3.2 删除 `docs/history/` 的历史正文与索引；以 `rg --files --no-ignore docs/history` 为空验证，并确认本 change archive 的 design matrix 仍可追溯每个 source。

## 4. 归档与交付验证

- [x] 4.1 按 `openspec instructions apply` 实施全部文档迁移；以 `openspec status --change consolidate-design-docs-into-openspec --json` 确认 planning artifacts 完整。
- [x] 4.2 运行 full relative-link check、OpenSpec strict validation、格式检查、`git diff --check`、source-path absence check 和敏感信息扫描；记录结构、链接和既有代码测试分别证明什么。
- [x] 4.3 读取 archive instructions，在覆盖、删除和验证完成后 archive change；以 `openspec list --specs`、archive 路径与 current spec 全链接检查确认十份 specs 已同步。
