# 仓库分层指引与渐进式发现设计

> 状态：**已替代（本地未提交，2026-09-14）。** 本文原先建议局部 `AGENTS.md` 说明继承和显式覆盖。当前决定改为：根 `AGENTS.md` 只在涉及相应模块时引导 Agent 阅读并优先遵守该模块规则；局部文件只描述本模块自身，不说明与任何其他 `AGENTS.md` 的关系。本文其余内容保留为被拒绝方案的设计记录，不是当前规则。
>
> 当前行为的权威来源仍分别是 [CLI 文档](../cli/README.md)、[API 文档](../api/README.md)、[配置文档](../configuration/README.md)、[开发指南](../development/README.md) 及已接受的 [ADR](../adr/README.md)。本文不是它们的替代品。

## 结论

Lorelum 不需要把每个目录都塞进 `AGENTS.md` 和 `README.md`。需要的是一个可预测的**渐进式发现链**：代理先获得全仓不可突破的边界，再只读取目标路径祖先中的局部规则；人类则从目录 README 进入对应领域的权威文档。这样既能把 Engine、CLI、Backend、format 等高风险边界放到离代码最近的位置，又不会把同一条规则复制到十几个文件中并逐渐漂移。

建议采用以下结构：

```text
仓库根目录
├── AGENTS.md                  全仓机器规则、规则解析方式、不可覆盖的红线
├── README.md                  产品、安装和用户入口
├── CONTRIBUTING.md            人类贡献、Issue/PR/CLA 流程
├── packages/
│   ├── README.md              包职责和依赖方向索引
│   ├── engine/AGENTS.md       检索/Store/index/benchmark 的局部规则
│   ├── cli/AGENTS.md          CLI 协议和工作树验证规则
│   ├── backend/AGENTS.md      daemon/runtime/HTTP adapter 的局部规则
│   └── format/AGENTS.md       公开 schema 与验证规则
├── docs/
│   ├── AGENTS.md              文档时态、权威来源和链接规则
│   ├── README.md              文档域总索引
│   ├── plans/README.md        计划状态与当前合同索引
│   ├── adr/README.md          不可变决策记录与生命周期（已有）
│   ├── cli/README.md          当前 CLI 合同索引（已有）
│   ├── api/README.md          当前 API 合同索引（已有）
│   ├── configuration/README.md 当前配置合同索引（已有）
│   └── development/README.md  开发与运行指南索引（已有）
└── apps/site、packages/ui     保留已有局部 AGENTS.md/README.md 模式
```

首轮不为 `config`、`shared`、`mcp`、`scripts`、`skills`、`plugins` 或每个 `src/` 子目录建立文件。只有出现真实的局部所有权、依赖约束、验证路径或反复误用时，才增加新的局部指引。

## 已观察到的现状

- 根 `AGENTS.md` 同时包含仓库身份、跨包依赖方向、CLI 验证、代码风格、测试、Git 流程和安全边界。它是有效的全仓基线，但稳定原则与高频的领域操作混在同一入口中，目标目录的代理必须阅读与当前工作无关的大量内容。
- `apps/site/AGENTS.md` 与 `packages/ui/AGENTS.md` 已采用正确的局部模式：明确继承根规则，仅补充该目录的 ownership、文件放置、局部命令、验证和例外。
- `docs/api`、`docs/cli`、`docs/configuration`、`docs/development` 与 `docs/adr` 均已有按领域划分的 README 索引；`docs/` 本身及 `docs/plans/` 还没有总入口。
- `docs/plans/` 混有草案、已实施设计、被替代的历史阶段和仍待实施的建议。部分文件已经主动指向当前 CLI 文档，但这一时态和权威来源的写法尚未统一。
- `packages/engine`、`packages/cli`、`packages/backend`、`packages/format` 是有明确高风险边界的核心包，却没有局部机器指引或人类可发现的包级索引。

根目录包含产品源码、文档、原生构建、安装脚本、Plugin 和 Skill 分发表面，这是发布仓库的合理组成，不应为了“看起来整洁”而进行无依据的物理搬迁。本设计解决的是阅读和决策的索引，而非重排所有文件。

## 目标与非目标

本阶段必须达到：

- 代理能从目标文件路径确定必须读取哪些 `AGENTS.md`，并知道哪些规则不可被局部文件放宽；
- 每项机器规则、面向人的导航、现行合同和架构历史都有唯一职责，不以复制维持可发现性；
- 修改高风险目录时，相关的放置规则、依赖边界和验证门槛出现在该目录附近；
- 计划文档不会被误读为已经生效的行为合同；
- 目录指引数量随真实决策边界增长，而不是随目录数量增长。

本阶段不做：

- 不重构源码布局，不改变 package 依赖、CLI/API/schema 或发布流程；
- 不创建新的 `docs/architecture/` 平行体系。跨目录、难以逆转的“为什么”继续由 ADR 承担；现行操作合同继续位于 CLI/API/configuration/development 文档；
- 不要求每个 package、命令、`src/`、fixture 或测试目录拥有 README 或 `AGENTS.md`；
- 不把 README 当作机器规则的继承输入，也不把 `AGENTS.md` 变成完整产品说明书。

## 规则解析与继承合同

### 代理读取顺序

对目标文件或任务路径，代理按以下顺序建立工作上下文：

1. 定位仓库根目录并读取根 `AGENTS.md`。
2. 从根目录向目标目录逐级收集存在的 `AGENTS.md`。例如修改 `packages/engine/src/query/query-service.ts` 时，只需读取根 `AGENTS.md` 和 `packages/engine/AGENTS.md`。
3. 依次应用祖先规则，再应用更窄目录的规则。
4. 仅在需要理解领域入口、当前合同或历史理由时，按局部 `AGENTS.md` 给出的链接读取 README、CLI/API 文档、ADR 或测试；不得因“可能有关”递归扫描整个仓库或整棵 `docs/`。

README、设计文档和 ADR 是可按需打开的事实与背景来源，不参与机器规则的自动继承。它们不能以普通文字悄悄覆盖 `AGENTS.md` 的操作边界。

### 覆盖语义

父目录规则默认继承。子 `AGENTS.md` 只能：

- 增加本目录独有的 ownership、依赖、文件放置、命令、验收或生成文件例外；或
- 在本目录范围内通过 `## Overrides` 或 `## Exceptions` 显式覆盖一个可覆盖的父规则，并写出被覆盖的父标题、适用范围和理由。

以下根规则不得被局部文件放宽：用户授权和审批门禁、秘密与隐私保护、许可证/发布限制、公开 Practice/pack/CLI/API 合同的设计对齐要求、不得直接提交 `main`，以及全仓已声明的产品范围红线（例如本地 MCP 不在当前范围内）。

如果两个同一作用域的文件给出冲突规则，或者局部文件未标注覆盖却与父规则矛盾，应视为文档缺陷；不能依靠“离文件更近的规则自动取胜”来掩盖冲突。

每个新局部 `AGENTS.md` 使用同一短模板：

```markdown
# AGENTS.md — <scope>

根 `AGENTS.md` 适用于本目录。本文件仅增加本目录的规则；
任何覆盖均在 `Overrides` 或 `Exceptions` 中明确声明。

## Ownership and boundaries

## File placement and dependencies

## Local verification

## Canonical references

## Overrides / Exceptions
```

没有实际覆盖时不保留空的 `Overrides / Exceptions` 小节。模板约束的是信息位置，不是篇幅配额；局部文件应足够短，使读者能辨别它增加了什么，而无需重新阅读根规则。

## 信息应归属到哪里

| 信息类型 | 唯一主要位置 | 其他文件如何引用 |
| --- | --- | --- |
| 所有贡献都必须遵守的机器边界、规则解析、全局禁止项和最小验证 | 根 `AGENTS.md` | 局部 `AGENTS.md` 声明继承，不复制全文 |
| 一个目录的 ownership、依赖方向、生成物、局部命令和验收 | 最近的局部 `AGENTS.md` | 根目录只保留目录地图和高层红线 |
| 产品是什么、如何安装、用户如何使用 | 根 `README.md` / `README.zh-CN.md` | `AGENTS.md` 只链接，不复述产品叙事 |
| 人类的贡献、Issue、PR、CLA 和评审流程 | `CONTRIBUTING.md` | 根 `AGENTS.md` 保留代理必须执行的简短边界并链接 |
| 当前 CLI、API、配置和开发操作合同 | 对应 `docs/<domain>/README.md` 及其页面 | 计划、README 和 AGENTS 只链接，不复制字段或行为 |
| 难逆架构决定的背景和理由 | `docs/adr/` | 新 ADR supersede 旧 ADR；不编辑历史结论 |
| 阶段性方案、未完成设计、替代关系和验收边界 | `docs/plans/` | 显式声明状态并链接当前合同 |

`packages/README.md` 只需列出各 package 的职责、允许的依赖方向和“何时读取哪个局部 `AGENTS.md`”。它不复制各 package 的实现规则。`docs/README.md` 只需按读者目标导航到当前合同、开发指南、ADR、plans、research 和 Plugin 文档；不汇总每一页的内容。

## 首轮目录覆盖范围

### 应新增局部 AGENTS.md

| 目录 | 下沉的独有规则 | 直接收益 |
| --- | --- | --- |
| `packages/engine/` | LocalStore 是权威事实、index 是派生状态、检索语义/快照/benchmark 归属、不得依赖 Backend 或 CLI | 避免检索和持久化规则散入入口层 |
| `packages/cli/` | 命令协议、JSON envelope、`--store-root` resolver、当前 worktree 的源码入口验证 | 避免各命令组自行形成不同执行路径 |
| `packages/backend/` | daemon/model 生命周期、loopback 控制面、HTTP 仅适配 Engine use case、不得在 controller 重实现 Engine 规则 | 防止 runtime 与检索职责回流到 controller |
| `packages/format/` | 公开 schema、frontmatter/validate/fixture 的协同修改、设计对齐和兼容性门槛 | 将最敏感的公开契约约束放到代码旁边 |
| `docs/` | 文档时态、权威来源、链接与“计划不是现行合同”的写作规则 | 防止维护文档被错误地当作运行时事实 |

`apps/site/AGENTS.md` 和 `packages/ui/AGENTS.md` 已满足该模式，首轮只需按新继承措辞校对，不做无收益重写。

### 应新增或补强 README 索引

| 文件 | 内容边界 |
| --- | --- |
| `packages/README.md` | 包职责、允许依赖方向、入口文件和局部指引导航；不写 package 内部操作细则 |
| `docs/README.md` | 读者任务导向的文档地图，并明确当前合同、ADR、plans、research 的不同权威性 |
| `docs/plans/README.md` | 每篇计划的状态、涉及范围、替代关系和当前合同链接；不把计划全文复制进索引 |

保留现有的 `docs/api`、`docs/cli`、`docs/configuration`、`docs/development`、`docs/adr`、`apps/site`、`packages/ui`、`native/embedding`、`plugins` 等 README。它们已有明确的领域用途。

### 暂缓目录

`packages/config`、`packages/shared`、`packages/mcp`、`scripts`、`skills`、`plugins` 与 `native/embedding` 暂不自动新增局部 `AGENTS.md`。其中 `packages/mcp` 的本地 MCP 禁令继续留在根规则；`plugins` 和 `native/embedding` 已有独立 README。只有满足下列准入条件时才增加：该目录有独立的真实职责和失败模式、需要不同于根目录的验证、并且无法用一条根规则或现有 README 清楚表达。

## 文档时态与 plans 索引

`docs/plans/` 必须被视为设计历史与待决设计的集合，而不是当前运行时合同。每篇 plan 的标题下使用统一的状态块：

```markdown
> 状态：Proposed | Accepted design | Implemented reference | Historical | Superseded
> 当前行为：<当前 CLI/API/configuration/development 文档链接，或“尚未实现”>
> 替代关系：<如适用，链接到取代本文的设计或 ADR>
```

- `Proposed` 说明方案可供审查，但不构成实现授权。
- `Accepted design` 说明设计已经对齐；它仍不能替代当前行为文档，实施须遵守该任务的授权与 Issue/PR 流程。
- `Implemented reference` 记录设计背景与验收边界，并链接已经生效的当前合同。
- `Historical` 记录过去阶段，不得据此实现或验收。
- `Superseded` 必须直接链接替代它的设计、ADR 或当前合同。

`docs/plans/README.md` 汇总这些状态和链接。新增计划时更新它；计划状态变化时同步更新它。ADR 继续使用现有的 `Proposed`/`Accepted`/`Deprecated`/`Superseded` 生命周期，不能把 plan 的状态当成 ADR 状态，也不应为了本设计创建平行的 `docs/architecture/`。

## 分阶段落地

### 阶段 1：确立解析合同与文档地图

1. 精简根 `AGENTS.md` 为全仓基线、目录地图、继承/覆盖合同和不可覆盖红线；跨包架构仅保留高层不变量，并链接到局部指引和现行文档。
2. 新增 `docs/AGENTS.md`、`docs/README.md`、`docs/plans/README.md` 与 `packages/README.md`。
3. 给存量 plan 补齐状态块和当前合同链接；先处理已被替代、历史阶段和最常被引用的文件，避免将所有历史文档重写成新格式。

交付标准是：一个陌生读者能从根目录进入正确文档域，并能明确区分“当前合同”“设计建议”“不可变架构决定”和“历史记录”。

### 阶段 2：将高风险操作规则下沉

1. 分别新增 `packages/engine/AGENTS.md`、`packages/cli/AGENTS.md`、`packages/backend/AGENTS.md`、`packages/format/AGENTS.md`。
2. 将根文件中只对这些目录有意义的细节移入对应局部文件，保留根层的不可替代边界和链接。
3. 用三类真实任务做冷读检查：Engine 检索变更、CLI 命令变更、文档/format 合同变更。每次只允许读取根规则、路径祖先规则和被局部规则明确链接的资料。

交付标准是：局部规则可独立解释“何时适用、要做什么、为何如此、何时停止”，但不依赖读者记住兄弟目录或 README 中未重复的关键条件。

### 阶段 3：把结构性错误自动化检查

新增轻量 `guidance:check`（具体脚本位置在实施 Issue 中决定），仅检查可机械判定的结构：

- 局部 `AGENTS.md` 有继承声明，且 scope 与文件目录一致；
- 明示的 `Overrides`/`Exceptions` 指向真实父规则，且不会覆盖不可放宽的根红线；
- README 与局部规则中的相对链接、引用路径有效；
- `docs/plans` 的索引、状态块和当前合同链接完整；
- 新增或移动目录时，PR 模板要求作者确认文档影响和唯一来源。

检查器不自动判定“这两句话是否语义重复”或“一个目录是否值得拥有 README”。这类判断保留给 PR 审查；机械化的关键词去重会制造误报，并鼓励为了通过检查而改写同一条规则。

### 阶段 4：以使用证据决定是否扩展

在至少一个完整迭代中记录：代理是否仍错误读取历史 plan、是否遗漏局部约束、是否出现需要频繁重复说明的目录，以及维护者是否能在 PR 中判断文档影响。只有出现可重复的实际问题，才考虑为 `native/embedding`、`plugins`、`skills` 或其他 package 增加局部文件。

## 验收与失败恢复

完成本设计的实施不以“新增了多少 README/AGENTS”为标准，而以以下可观察结果验收：

- 对任意目标路径，规则链可由“根 + 目标祖先”唯一确定；未标记的冲突会被检查器或审查阻止。
- 修改 Engine、CLI、Backend、format、site 和 docs 时，代理能定位各自局部边界，而不会默认加载全部仓库规则。
- 根 `README.md`、`CONTRIBUTING.md`、根 `AGENTS.md` 与 `docs/` 不再各自复制同一领域的完整合同；每条关键链接有单一权威目的地。
- 打开 `docs/plans/README.md` 即可判断一篇 plan 是待审、已对齐、历史还是已被取代，并能跳转到现行合同。
- 新目录仅在满足准入条件时新增说明文件；空模板和仅复述父规则的文件在审查中被拒绝。

若试点证明某个局部 `AGENTS.md` 没有提供独立决策价值，应删除该文件，并把仍然有效的唯一规则迁回父级或相应的权威文档。渐进式索引的目标是降低查找成本，不是增加治理文件数量。

## 需要维护者确认的决定

本方案建议先把下列事项作为一个 docs/governance Issue 对齐，再实施：

1. 是否接受“根规则不可放宽、局部覆盖必须显式标记”的继承合同；
2. 是否接受首轮只覆盖 `docs`、Engine、CLI、Backend、format，而不机械铺满所有目录；
3. 是否接受 plans 的统一状态块和 `docs/plans/README.md` 作为时态索引；
4. 是否在首轮同时引入 `guidance:check`，还是先以冷读审查收集一个迭代的结构性失败证据后再自动化。

用户已于 2026-09-14 授权实施分区 `AGENTS.md`，但拒绝本文提出的局部继承/覆盖说明。当前实现以根目录模块路由和自包含局部规则为准。README 总索引、plans 状态索引与 `guidance:check` 仍是后续决定；在它们获得单独授权前，不应据此批量创建 README、迁移历史文档或增加自动检查。
