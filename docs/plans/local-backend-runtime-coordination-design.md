# Backend 按需运行：历史阶段记录

状态：已被替代。最后更新：2026-09-13。

本文件原先定义的能力是：semantic query、index build/rebuild 在 Backend 未启动时启动它，但只加载已经存在的模型。它不再是当前合同，不能据此实现或验收功能。

当前行为见[本地模型自动准备与前台非阻塞执行](./automatic-local-model-provisioning-design.md)：

- 首次实际需要 embedding 时，semantic query、index build/rebuild 和 install-driven index 会按需启动 Backend，并自动开始或加入固定模型的 configured download/续传；keyword、status 和 `backend start` 不下载。
- query 不会自行建立或修复 index，只短暂观察模型准备过程；未 ready 时返回 `ok: true`、exit 1 的 `data.state: "preparing"`，不伪造检索结果。
- index 和 install 将已接受的 operation 留在同一 daemon 内继续；分别返回 `preparing`/`building` 或 `indexSync.pending`。
- `lore model load` 仍是用户主动等待、检查进度和重试失败传输的入口。

这里不再保留旧的 `local-only`、`prepare-local`、同步等待或“缺模型即失败”规则，避免它们与当前 CLI/API 文档冲突。跨 daemon 重启的持久追赶、调度和队列仍由 [#115](https://github.com/lorelum/lorelum/issues/115) 单独处理。
