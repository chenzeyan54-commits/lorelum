## Purpose

定义 Lorelum 面向 AI coding agent 的本地集成边界，使宿主可以稳定检索 Practice，而不会获得第二套本地 runtime、Store 或 MCP 行为。

## ADDED Requirements

### Requirement: CLI-first local integration
本地 Agent integration SHALL 使用已发布的 `lore` CLI 加宿主原生 Skill 与 Hook。Plugin、Skill 和 Hook MUST 通过 CLI 的 list、query 与 get 合同取得内容，且 MUST 不直接读取 LocalStore、导入 Engine/Backend、复制排序或错误语义。

#### Scenario: A host needs a relevant Practice
- **WHEN** 宿主 Agent 需要发现或读取 Practice
- **THEN** 集成 MUST 通过 `lore` CLI 的公开 JSON 合同完成发现、query 或 get，而不得绕过 CLI 访问内部包

### Requirement: No local MCP surface
当前产品 MUST 不提供或预留本地 MCP server、stdio transport、MCP tools、MCP-backed Plugin/UI/authentication，`packages/mcp` MUST 继续被视为非产品 scaffold。只有需要 Lorelum 运营的远程检索服务时，才可以在新批准的设计中重新评估 MCP。

#### Scenario: Adding a host integration
- **WHEN** 新的本地宿主集成需要调用 Lorelum
- **THEN** 其 MUST 采用 CLI + Skill/Hook 路径，且 MUST 不新增本地 MCP 便利层或第二条本地调用路径
