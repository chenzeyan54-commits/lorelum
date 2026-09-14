# Agent 集成范围

- 状态：当前有效决策
- 日期：2026-09-14
- 适用：Lorelum CLI、Host Plugin、Skill、Hook 以及相关规划

## 决定

Lorelum 当前是 **CLI-first** 的本地产品。面向 AI Coding Agent 的本地集成只使用已发布的 `lore` CLI，加上宿主原生的 Skill 和 Hook。

当前不设计、不实现、不预留本地 MCP：包括 stdio server、MCP tool schema、MCP Plugin wiring、通过 MCP 调用本地 Store/Backend 的便利层，以及以 MCP 为前提的本地 UI。CLI 的性能、单二进制分发和已有 JSON 合同优先于为宿主增加第二条本地调用路径。

## 当前可交付的 Plugin 范围

- 使用编译后的 `lore` CLI 读取 Pack、query 和 get Practice。
- 使用 Skill 描述何时检索、如何读取完整 Practice、何时采用 keyword 路径。
- 使用宿主 Hook 在有限生命周期事件注入紧凑、可恢复的上下文，例如 Codex compact 后的 Pack Catalog 恢复。
- 维护 Plugin manifest、品牌资产、marketplace、安装、更新、信任和本地开发文档。

## 明确不在范围内

- 本地 MCP server、stdio transport、MCP tools、MCP Apps/UI 或本地 MCP authentication。
- 为 CLI 再包一层 MCP，以获得工具发现、结构化 schema、UI 或宿主通用性。
- 让 Plugin 读取 LocalStore、直接导入 Engine/Backend，或复制 CLI 的检索与错误合同。
- 因为仓库存在 `packages/mcp` 或历史设计提过 MCP，就把它当作当前路线或未完成工作。

## 未来重新评估的门槛

只有 Lorelum 已进入平台化阶段，并且需要一个由 Lorelum 运营的**远程检索服务**时，才可以重新讨论 MCP。该讨论必须从新的 Issue 和设计开始，明确用户、租户与授权、数据驻留、远程服务可靠性、CLI 与远程服务的关系、性能证据和发布策略。

这不是当前 Plugin 或 Semantic Query 的后续任务，也不授权实施本地 MCP。

## 给 Agent 的工作规则

当任务涉及 Agent 集成或 Codex Plugin 时，默认选择 CLI + Skill + Hook。不要把 MCP 列为推荐项、备选项或“未来兼容”抽象；除非用户明确把任务范围改为上述平台化远程检索服务，并已要求进行相应设计。
