# Query 实现规划（历史记录）

- 状态：已归档，不是当前实现合同。最后更新：2026-09-13。
- 原始用途：在 Semantic Query v1 交付前，讨论关键词检索、Profile、provider、semantic query 和 Hybrid 的早期拆分。

这份早期规划中的 `--profile`、Store-scoped config、默认 keyword、显式 semantic/hybrid 以及具体融合方案都没有成为当前产品合同。保留它不会帮助实现当前功能，反而容易让后续工作按过期接口推进，因此正文已从工作树中移除；完整历史仍可从 Git 记录查看。

当前应使用以下文档和 Issue：

- [Query 路线图](./query-roadmap.md)：已交付能力、当前 #114，以及后续阶段的证据门槛。
- [Semantic Query v1 设计](./semantic-query-v1-design.md)：固定本地 Profile、默认 semantic query 和显式 keyword 路径。
- [Backend 按需启动与本地模型准备](./local-backend-runtime-coordination-design.md)：当前 #114 的运行体验与公共协调边界。
- [#128](https://github.com/lorelum/lorelum/issues/128)：当前同步 install index；[#115](https://github.com/lorelum/lorelum/issues/115) 留给持久任务队列与自动补偿。
- [#85](https://github.com/lorelum/lorelum/issues/85)、[#126](https://github.com/lorelum/lorelum/issues/126)、[#127](https://github.com/lorelum/lorelum/issues/127)：评测、Hybrid 与检索优化的后续门槛。
