## Purpose

为 Registry Pack 的选择、安装和更新提供稳定的版本解析合同，使用户文档可以默认使用最新稳定发行版，同时仍能显式固定可复现版本。

## ADDED Requirements

### Requirement: Registry release selection
`lore pack install <name>` SHALL 在未指定版本时解析 selected Registry 中该 Pack 的最高稳定 SemVer release，且不得依赖 Registry YAML 的排列顺序。`lore pack install <name>@<version>` MUST 只解析该精确版本；不存在的 Pack、没有稳定 release 或不存在的精确版本 MUST 返回明确的 Registry error，且不得降级为其他 release。

#### Scenario: Unpinned installation chooses the latest stable release
- **WHEN** Registry 为一个 Pack 提供多个稳定 release，调用方执行未带 `@version` 的 install
- **THEN** CLI MUST 安装其中版本最高的稳定 release

#### Scenario: Exact version is unavailable
- **WHEN** 调用方请求 Registry 未声明的精确 Pack 版本
- **THEN** CLI MUST 返回 version-not-found error，且不得安装最新或其他版本

### Requirement: Install and update replacement boundary
安装结果 SHALL 标识其解析到的 Pack 版本与来源。当同名已安装 Pack 的 artifact 与请求 release 不同而不能作为 idempotent install 保留时，`lore pack install` MUST 返回 update-required；调用方 MUST 使用 `lore pack update` 替换已安装 Pack。Pack canonical commit 与 install 后 `indexSync` 的 ready、pending、failed 语义仍由 `semantic-index` 负责。

#### Scenario: Changed installed Pack requires explicit update
- **WHEN** 已安装 Pack 与 selected Registry release 的 artifact 不同
- **THEN** install MUST 返回 update-required，并且不得静默替换已安装内容
