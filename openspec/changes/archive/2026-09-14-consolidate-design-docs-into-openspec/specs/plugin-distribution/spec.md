## Purpose

为 Lorelum Codex Plugin 保持唯一、可安装且可维护的公开身份，同时确保 Plugin 只编排宿主上下文，不复制核心检索 runtime。

## ADDED Requirements

### Requirement: Single public Plugin identity
公开 marketplace SHALL 只暴露一个名为 `lorelum` 的 Lorelum Codex Plugin，并使 marketplace 名称、Plugin ID、source root 与安装 selector 保持一致。维护者开发覆盖 MUST 不与公开 source 同名并存，也 MUST 不将本地覆盖配置提交到版本库。

#### Scenario: Marketplace installation
- **WHEN** 用户从公开 marketplace 选择 Lorelum Plugin
- **THEN** marketplace metadata MUST 解析到 `plugins/lorelum/` 的同一 Plugin identity，而不得解析到别名、重复 source 或本地覆盖目录

### Requirement: Plugin runtime boundary
Plugin 的 Skill 和 Hook SHALL 在新任务或明确 lifecycle event 中调用已安装的 `lore` CLI；它们 MUST 不启动、打包、配置或调用本地 MCP server，也 MUST 不持有 Store、Backend 或排序实现。

#### Scenario: New coding task begins
- **WHEN** 宿主为新的 coding task 装配 Lorelum 上下文
- **THEN** Plugin MAY 通过 Skill/Hook 引导 CLI 检索，但 MUST 保持检索状态和错误语义由 CLI 负责
