## Purpose

定义 Lorelum 站点当前的功能模块、依赖方向与 SSR/视觉边界，使目录演进不会破坏 routes、Fumadocs、locale、共享 UI 或 vendored source 的责任归属。

## ADDED Requirements

### Requirement: Route and feature ownership
站点 route 文件 SHALL 只承担 TanStack URL、head、loader 与 response glue。产品页面代码 MUST 位于 `src/features/<feature>/`，稳定的跨站能力 MUST 位于 `src/shared/`，且 shared MUST 不导入 feature；routes MUST 不承载 feature business/UI composition。

#### Scenario: Adding a Docs or Landing behavior
- **WHEN** 新页面行为属于 Landing 或 Docs
- **THEN** 实现 MUST 位于对应 feature，route 仅连接框架合同，且 shared 不得反向导入该 feature

### Requirement: Vendor and user-content isolation
vendored React Bits source SHALL 仅依赖外部 packages，并保持其独立的 client-only import boundary；它 MUST 不导入 feature 或 shared。用户文档 MUST 位于 `content/docs/`，generated `src/routeTree.gen.ts` MUST 不被手工修改，且目录迁移 MUST 不移动 MDX 或破坏 Fumadocs search/prerender/locales。

#### Scenario: Updating vendored visual source
- **WHEN** 维护者调整 vendored React Bits component
- **THEN** component MUST 保持 vendor dependency boundary 和 provenance，且不得借此创建 feature/shared 的反向依赖

### Requirement: SSR-safe visual behavior
site-owned browser API 访问 MUST 位于 effect、event handler 或其他 client-only callback；site-owned GSAP work MUST 在受控 context 中创建并可清理。视觉或 motion 改动 MUST 保持现有 theme、locale、键盘/触控状态与 SSR 安全，并通过受影响 route 的 typecheck、tests、build 和人工视觉验证。

#### Scenario: Feature motion change
- **WHEN** Landing 或 Docs 增加或修改 site-owned motion
- **THEN** 实现 MUST 在 client-safe lifecycle 内清理资源，并验证两种 theme、受影响 locale 与交互状态
