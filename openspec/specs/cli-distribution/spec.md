# cli-distribution Specification

## Purpose
定义 Lorelum CLI 的平台发布包和安装器合同，使用户无需预装 Bun、Node 或 sudo 即可得到与 native runtime 字节一致、可恢复的单一命令入口。

## Requirements

### Requirement: Self-contained verified platform package
每个支持目标的发布包 SHALL 包含 `lore` CLI、匹配 target 的 native runtime、manifest 和必要 notices/licenses。安装器 MUST 在安装前验证下载文件、archive layout、目标 manifest 与解压路径安全性；CLI 与 native runtime MUST 来自同一已验证 asset，不得由安装器重新构建或混搭。

#### Scenario: Valid platform archive
- **WHEN** 用户安装与当前平台匹配的发布 archive
- **THEN** 安装器 MUST 只接受包含匹配 native manifest 的完整 archive，并在验证失败时拒绝安装而不留下可用入口

### Requirement: Atomic and non-invasive installation
安装器 SHALL 将版本内容安装到用户可写目录，并仅在完整验证后原子切换 `lore` 命令入口。安装器 MUST 不要求 Bun、Node 或 sudo，MUST 不修改 shell startup 文件，也 MUST 不覆盖或删除外部管理的同名入口；失败、取消或损坏 archive MUST 不产生半安装状态。

#### Scenario: Existing external command
- **WHEN** 安装目标位置已有不是 Lorelum 安装器管理的命令
- **THEN** 安装器 MUST 停止并说明冲突，而不得覆盖该命令

### Requirement: Release asset provenance
Draft/release 验证 MUST 针对准备发布的同一 asset 执行；发布权限仍属于人工批准的 release workflow，且验证通过 MUST 不自动发布、签名或上传资产。

#### Scenario: Draft verification succeeds
- **WHEN** 某个 draft asset 通过安装和运行验证
- **THEN** 验证记录 MUST 只证明该 asset 可用，且系统 MUST 不自动将其发布为正式 release
