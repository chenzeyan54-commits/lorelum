# Lorelum Query 路线图

- 状态：当前路线图。最后更新：2026-09-13。
- 原则：一阶段只解决一个已经确认的用户问题。完成并验收后，再决定下一阶段；不把后续技术名词或实现方案预先当作承诺。

## 已交付

| 能力 | 当前合同 |
| --- | --- |
| `lore get` | 按稳定 Practice ID 读取 canonical 内容。 |
| `lore query --mode keyword` | 零配置、离线的关键词检索。 |
| 默认 `lore query` | 固定本地 Profile 的 semantic query；缺 index 或不兼容时明确失败，不降级 keyword。 |
| `lore index build` | Store-scoped semantic index 的显式构建、增量更新、原子发布与按需 local runtime。 |
| `lore pack install` | canonical Pack commit 后提交同 Store 的普通增量 index build，并以 `indexSync.ready/pending/failed` 呈现派生状态。 |

完整用户合同见 [Query CLI 文档](../cli/query.md)。Engine 是 Store、index 和检索语义的所有者；Backend 承载可复用的本地模型 runtime；CLI 负责选择路径和输出协议。

## 当前阶段：#114 与 #128 运行体验补齐

目标是让机器重启后的默认 query、显式 index build/rebuild 都可以自己启动 Backend；模型缺失时自动开始后台下载。query 短暂观察后返回 preparing，index/install 返回可追踪的 pending operation；keyword 继续离线。

这一阶段的验收是：已有模型时，停 Backend 后 query、index rebuild 和 install→index→query 成功；模型缺失、index 不可用、Backend 冲突、并发调用和取消都有确定、可恢复的行为。当前设计见 [Backend 按需启动与本地模型准备](./local-backend-runtime-coordination-design.md) 与 [Index 按需运行与 Pack 安装后同步索引](./index-runtime-and-install-sync-design.md)。

## 已登记、暂不实施的后续阶段

| 触发条件 | 后续事项 | Issue |
| --- | --- | --- |
| 同步等待已影响安装体验，或要让 CLI 退出后仍可靠追赶 | 持久任务队列、自动补偿、前后台任务协调 | [#115](https://github.com/lorelum/lorelum/issues/115) |
| 要决定是否更换模型或支持更多 Profile | 可复现的多 Pack 质量与性能评测 | [#85](https://github.com/lorelum/lorelum/issues/85) |
| 评测证明单一路径有稳定缺口 | 设计 Hybrid Query，并在同一评测集验证 | [#126](https://github.com/lorelum/lorelum/issues/126) |
| 评测定位到具体排序、表达或规模问题 | 再决定是否需要 rerank、多向量、query transformation 或 ANN | [#127](https://github.com/lorelum/lorelum/issues/127) |

这些 Issue 是问题与证据门槛的记录，不是当前实现清单。尤其是 Hybrid 和检索优化，必须先有 #85 的多 Pack 数据，再单独设计公开行为和回退方案。

## 不变边界

- LocalStore 是 Pack 和 Practice 的事实来源；所有 index、任务和模型 runtime 都是派生或用户级状态。
- `--store-root` 只选择 Store 与其 index，不选择模型、模型缓存或 Backend 地址。
- 自动 semantic 路径只下载固定公共模型资源，不发送 Practice 或 query；`lore model load` 用于显式等待或重试失败的下载。
- keyword 保持离线可用；semantic 失败时不静默降级。
- 任何新阶段先产出与仓库规则一致的 Markdown 设计，再实现。
