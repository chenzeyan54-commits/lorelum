# Index 按需运行与安装后索引：历史阶段记录

状态：已被替代。最后更新：2026-09-13。

本文件原先规定：`lore pack install` 在 Pack commit 后同步等到 index build 终态，缺模型则以失败结束。这个同步合同不再是当前行为，不能据此实现或验收功能。

当前行为见[本地模型自动准备与前台非阻塞执行](./automatic-local-model-provisioning-design.md)：

- `index build/rebuild` 先提交 daemon 持有的 operation。首次真正需要模型时，Backend 自动开始或加入下载；同一 operation 在模型 ready 后重新进入 Engine build/rebuild。
- CLI 只观察约一秒：ready 直接返回；仍在执行时返回 `preparing` 或 `building` 加 operation ID；已失败时返回正常错误 envelope。`lore index operation <id>` 读取已接受 operation 的状态，不启动 Backend。
- `lore pack install` 先完成 canonical Pack commit，再提交同 Store 的普通增量 index operation。CLI 只做短暂观察：完成时 `data.indexSync` 为 `ready`，仍在准备或构建时为 `pending` 并带 operation ID，失败时为 `failed`；Backend 在同一 daemon 内继续已接受的 operation，任何派生 index 结果都不回滚 Pack。
- Engine 仍拥有增量判断、Store snapshot fence 和原子发布。Backend 只拥有模型准备和 operation 生命周期；下载期间不能持有 Engine staging、Store mutation 或 index writer 锁。

这个阶段只保证**同一 daemon 内**已接受的 operation 会继续。Backend 停止或崩溃后，旧 operation ID 不保证可恢复；持久任务、重启追赶、跨 Store 排队与公平调度仍由 [#115](https://github.com/lorelum/lorelum/issues/115) 单独设计。
