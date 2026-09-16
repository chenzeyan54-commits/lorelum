# 隔离验收记录

本记录只描述 `add-project-context-packs` 的实现期验证；current specs 尚未同步，change 也尚未归档。

## 已执行命令

在仓库根目录执行：

```sh
bun test packages/cli/src/project-context/query-get.integration.test.ts \
  packages/engine/src/project-context/resolver.test.ts \
  packages/engine/src/project-context/semantic-progress.test.ts \
  packages/backend/src/modules/query/project-semantic-runtime.test.ts \
  packages/backend/src/modules/query/project-operation-journal.test.ts \
  packages/backend/src/modules/query/controller.test.ts \
  packages/backend/src/modules/index/controller.test.ts \
  packages/engine/src/project-context/cache-manager.test.ts \
  packages/cli/src/cache/commands.test.ts
```

测试在临时 Store、普通目录、`.lorelum/` layer 和临时 cache root 下运行；不读取开发者 Store，也不使用 Git metadata 作为 context 或 artifact 身份。

## 观察结果

- parent/child layer 默认继承；child 按单条 Practice 覆盖，`--no-project` 返回 Store-only 结果。
- 一个坏 Practice 只被 ignored；同 Pack 邻居和低优先级 fallback 仍可 query/get/index。
- Store-only 100 条 target 的第二批被阻塞时，semantic query 返回 current progress 的 `50 / 100` partial；未发布的 50 条不进入候选。
- 相同最终语料的两个无关普通目录得到相同 operation ID，document embedding 只发生一次；路径、Git/worktree、branch 和 mtime 不参与 artifact identity。
- 同一目录连续 source edit 会 supersede 旧 target；旧 target 后续 batch 不再发布为当前结果。
- daemon journal 只持久化 opaque source/slot/cache/artifact identity、Profile、计数和状态。restart 后未完成 target 进入 `waiting-for-source`；下一次同 source command reattach。
- `lore cache prune` 只清理未被 artifact lease 保护的派生数据；不写项目 source 或 LocalStore。强制 rebuild 失败时旧 `active.sqlite` 仍保持 ready。

## Native smoke（2026-09-16，Asia/Shanghai）

在 Apple M4、32 GiB RAM、macOS arm64、Bun 1.4.2 上执行：

```sh
bun run build:native
bun run test:native-smoke -- /absolute/path/to/granite-q4_0.gguf
```

该仓库内 smoke 创建普通目录 ProjectContext、临时 Store/cache/runtime/model cache，并以只读本地模型文件作为会在 1 MiB 后中断一次的 loopback 下载源。它不读取或写入开发者 Store、cache、模型 cache 或 Backend。一次通过的 48 条 Practice 观测为：首次 `--max-wait-ms 0` 提交 33.3 ms、partial query 20.3 ms、complete query 20.6 ms、5 次 warm query 的 p50/p95 为 17.8/18.7 ms、相同语料普通目录 query 21.0 ms、单条变更 `index build` 提交 114.0 ms、`rebuild` 提交 113.3 ms。初始 48 条 document embedding 实际累计 1340.7 ms（35.8 documents/s），单条增量 embedding 为 29.8 ms（33.5 documents/s）。该 run 确认空模型 cache 首次 query 会自动进入可恢复 pending 状态而不是 `backend.deadline-exceeded`，并覆盖 model download、partial/strict/complete、artifact reuse、单条增量、rebuild、cache prune、model unload/reload 与坏 Practice fallback；同时确认 partial query 使用 query embedding，而不会作为 document embedding 计入 index 工作。

## 限制

以上是单机 native smoke 的功能验收与观测样本，不是跨机器容量/吞吐 benchmark；它不固定自动 LRU 容量、queue fairness 或正式性能阈值。受控 EmbeddingPort 的单元/协议测试仍负责确定性的并发、restart reattach 和高频编辑合并矩阵。
