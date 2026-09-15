## ADDED Requirements

### Requirement: Resource-aware Pack artifact lifecycle

当 Pack 包含 references/、assets/ 或 scripts/ 时，Registry materialization、local directory decode、candidate construction、snapshot write/decode、seal、install、update、uninstall 和 recovery MUST 将这三个目录中的已验证普通文件作为同一个 Pack artifact 的组成部分。resources MUST 按其已验证 relative path 保存原始 bytes，artifact identity MUST 随任一 resource file 的 bytes 或路径变化而变化。

resources 单独变化的 update MUST 原子替换 active Pack artifact 并更新 Pack generation，但 MUST NOT 改变未变 Practice 的 source、Effective Practice delta、effectiveRevision 或触发 keyword/semantic index work。Pack install/update MUST NOT 因 resource 存在而执行 script、安装依赖或注册宿主功能。

#### Scenario: A resource-only update replaces the active Pack artifact

- **WHEN** 同名 Pack 的 selected release 只改变 assets/、references/ 或 scripts/ 下的内容，而所有 canonical Practice 内容保持不变
- **THEN** lore pack update MUST 原子激活新的 artifact identity，且后续 lore get source locator 不得把新 Practice 与旧 resource bytes 混合

#### Scenario: A resource-only update leaves retrieval revision unchanged

- **WHEN** resource-only update 完成且所有 Practice canonical content 保持不变
- **THEN** Store MUST 保持 effectiveRevision 与 Practice delta 不变，且不得因此构建或同步派生 retrieval index

#### Scenario: An existing Pack has no resource directories

- **WHEN** 新客户端安装或恢复一个只包含既有 Pack 文件的 release
- **THEN** 系统 MUST 将其视为 resources 为空，并保持该 Pack 原有 artifact 和 retrieval 行为
