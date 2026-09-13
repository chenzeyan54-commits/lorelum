# Lorelum Plugin 命名与分发设计

> 状态：实施中。本文只定义公开命名、目录与分发边界；不改变 Lorelum CLI、Store 或检索合同。

## 结论

Lorelum 是产品和发布方。当前 Codex 适配物使用一个完整的 Lorelum Plugin，不按检索、学习或其他能力提前拆分。公开 marketplace 和 Plugin ID 都是 `lorelum`，用户安装 `lorelum@lorelum`，界面显示为 **Lorelum for Codex**。

```text
plugins/
  README.md
  lorelum/
    .codex-plugin/plugin.json   # name: "lorelum"
    hooks/
    skills/
    scripts/

.agents/plugins/marketplace.json  # name: "lorelum"
docs/plugins/codex.md              # 公开安装和使用
docs/development/plugins.md        # 本地开发与热更新
```

`plugins/` 的语义是“可独立安装的宿主产物”，不是一层通用 integration framework。`plugins/lorelum/` 当前恰好是 Codex 所需的 Plugin manifest、Hook、Context 格式和 Skill；它不意味着 Lorelum 只支持 Codex，也不承担其他 Agent 的抽象层。

当另一个 Agent 实际需要独立的安装包时，再按照该宿主的 Plugin/Marketplace 规则增加一个产物。届时是否复用 `lorelum` 这个公开 ID，取决于宿主的 namespace 和安装格式；现在不预建空目录，也不为了未来把当前结构再嵌一层 `integrations/<host>/`。

## 已确认现状

- 当前实现已迁移到 `plugins/lorelum/`；目录名、manifest `name` 和 marketplace entry 都是 `lorelum`。
- Plugin 位于 Bun workspace 外，通过 `lore list packs` 读取受 CLI 合同保护的 Catalog；它不导入 Engine，也不拥有 Store、排名或 Practice 语义。
- Catalog 生命周期、Hook、Context 字符预算和 Skill 均是 Codex 适配行为。CLI 的 `list packs` 合同刻意不定义这些宿主生命周期。
- 仓库 marketplace 是公开分发定义。维护者本地开发时，Codex 可以把当前 checkout 作为同名 marketplace source；该覆盖不进入 Git 配置。

当前尚未发布旧的 `lorelum-codex` 公开 selector，因此不保留兼容副本或别名。如果未来发现已有实际用户，迁移、弃用与缓存清理由一个单独的发布决策处理。

## 责任边界

| 层 | 拥有的责任 | 不拥有的责任 |
| --- | --- | --- |
| Lorelum Core / Engine / CLI | Pack、Practice、Catalog、检索与错误合同 | 感知宿主会话、Hook 或上下文窗口 |
| `plugins/lorelum/` | Codex 生命周期、上下文格式、Skill、Codex 安装元数据 | 重写 `lore` 命令、读取 Store 文件、重排 Practice |
| `lorelum` marketplace | 发布方命名、可安装条目与版本发现 | 开发机器路径、个人 cachebuster、运行时状态 |
| 维护者本地开发覆盖 | 指向当前 checkout 的测试安装 | 对外发布或用户默认安装来源 |

Plugin 对 Core 的唯一运行时依赖是公开 CLI：Hook 读取 `lore list packs`，Skill 在合适的任务或决策时读取 `lore query` 和 `lore get`。它不需要知道 Store 的文件布局，也不应复制检索和排名规则。

## 公开安装与维护者开发

普通用户添加 Git marketplace 后安装 `lorelum@lorelum`。更新时刷新 marketplace，再重新安装 selector。安装后用新 Codex task 载入最新 Skill 与 Hook；Hook 改动需要重新审查和信任。

维护者把当前 checkout 作为本地 marketplace source 时，仍安装 `lorelum@lorelum`，但同名 marketplace 只能保留一个 source：本地 source 与公开 Git source 不能同时配置。开发 cachebuster 只用来促使 Codex 重新读取本地 Plugin，不是版本发布方式，提交前必须恢复到预期的正式版本。

两条路径复用 `plugins/lorelum/` 的同一份源码。本地 marketplace 只是开发覆盖，不是一个名为 `lorelum-local` 或 `lorelum-dev` 的第二产品，也不出现在面向用户的公开安装文档中。

## 本阶段完成项

1. `plugins/lorelum/` 作为唯一的 Codex Plugin 根目录。
2. manifest、marketplace 和公开 selector 使用 `lorelum`；显示名为 **Lorelum for Codex**。
3. 仓库提供可发现的 `.agents/plugins/marketplace.json`，source 为 `./plugins/lorelum`。
4. 用户安装说明与维护者热更新说明分离，明确 CLI/Bun 前置依赖、Hook 信任和新 task 边界。
5. Plugin 继续经 CLI 获取 Catalog；目录迁移不改变 CLI/Engine/Store 行为。

## 不做的事

- 不把 Plugin 放进 `packages/engine`、`packages/cli` 或 `packages/shared`。
- 不预建 Claude Code、Cursor 等空目录，不猜测它们的 Hook、Skill 或安装格式。
- 不因为 learn 机制可能出现就提前拆分第二个 Codex Plugin。只有需要独立安装、权限/信任、目标用户或发布节奏时才拆分。
- 不将 Codex 的 Context 限制、`SessionStart` 事件或 Hook JSON 视为跨宿主合同。
- 不将个人 marketplace、绝对路径、cachebuster 或开发机环境变量提交为公开分发配置。
- 不为未发布的 `lorelum-codex` 保留兼容副本。

## 验收与后续决策

本阶段的验收是：仓库 marketplace 发现 `lorelum`，Plugin root 与 manifest 名称一致，`lorelum@lorelum` 的公开安装说明和 checkout-backed 开发说明都能被独立执行；二者不会同时加载。Hook 仍只通过 CLI 获取 Catalog，CLI/Engine 行为与 Store 内容不因目录调整发生改变。

第二宿主出现时，再基于真实的安装、生命周期、Context 预算和信任模型，决定其 Plugin 根目录、ID、是否共享素材或是否存在独立发布需求。
