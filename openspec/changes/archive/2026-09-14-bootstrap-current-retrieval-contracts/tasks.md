## 1. 建立可审查的当前合同

- [x] 1.1 核对三个 delta specs 的每条 requirement 均只描述已实现行为，并以 `openspec validate --all --strict --no-interactive` 验证 OpenSpec 结构。
- [x] 1.2 核对 design 的 evidence map、current/history 边界与不引入本地 MCP 的范围，并以人工 diff review 验证不把 Proposed ADR 或路线图升级为当前合同。

## 2. 迁移历史设计与入口

- [x] 2.1 将五份已选旧设计正文移至 `docs/history/plans/`，只加入历史身份、基线及必要相对链接修复；以正文差异检查验证未重写历史推导。
- [x] 2.2 将五个旧路径（包含 `openspec-migration-design.md`）改为简短入口，并更新三份既有历史指针；以 Markdown 相对链接检查验证它们都指向 current spec 或明确的历史资料。

## 3. 建立导航和 Agent 读取边界

- [x] 3.1 新增 docs 根导航、history 说明和 `.rgignore`，以 `rg` 验证默认搜索不会枚举 `docs/history/` 与 `openspec/changes/archive/`。
- [x] 3.2 更新根 `AGENTS.md`、development guide 与相关 CLI/API 参考，使 current specs、ADR、接口参考和历史资料各自有明确入口；以链接检查和人工阅读验证有效 CLI-first 与设计规则仍可发现。

## 4. 应用、验证与归档

- [x] 4.1 读取并遵循 `openspec instructions apply` 的输出，完成本 change 的文档实施；以 `openspec status --change bootstrap-current-retrieval-contracts --json` 确认所有 planning artifact 完整。
- [x] 4.2 运行针对性 query/index/model tests、格式检查、相对链接检查、`git diff --check` 与敏感信息扫描；记录每项命令对当前文档 diff 的适用性。
- [x] 4.3 读取 archive instructions，在全部任务完成后 archive change；以 `openspec validate --all --strict --no-interactive` 和 `openspec list --specs` 验证三份 delta 已同步为 current specs。
