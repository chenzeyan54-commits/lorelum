# 本地模型自动准备与前台非阻塞执行

状态：已在 PR #135 实现，待合并；尚未发布。2026-09-13。用户已明确要求缺模型时自动下载，且不得让 query、index、install 长时间等待。本文件定义该行为的实施合同，并取代旧设计中普通 semantic 操作禁止下载、安装必须同步等到 index 终态的要求。

推荐让 Backend 在首次实际需要 embedding 时自动下载并加载固定模型。模型准备与 index operation 由 daemon 持有，CLI 只短暂观察结果：query 没有检索结果时明确返回“模型正在准备”；index 和 install 返回可查询的 pending 状态，daemon 在模型 ready 后继续完成已经接受的 index 操作。后台下载开始以后，CLI 退出不能使它取消。

这需要同时修改执行生命周期和结果合同。仅将 `local-only` 改为 `configured-download` 会使现有轮询等待整个下载，仍不满足用户要求。

## Observed：当前证据

以下记录的是本阶段开始前阅读代码和测试得到的基线，用来说明为什么不能只调整一个 policy；不是对新方案的运行验收。实现完成后，旧 `local-only` 接口和 policy 已被删除。

| 证据 | 当前行为及影响 |
| --- | --- |
| [`models/prepare.ts`](../../packages/backend/src/models/prepare.ts)、[`prepare.test.ts`](../../packages/backend/src/models/prepare.test.ts) | 当时的 `local-only` 不创建缓存、不下载、不续传 `.part`；`configured-download` 已复用下载器、校验和、私有文件检查和 SQLite writer lock，验证后原子改名。自定义 `modelPath` 优先，损坏文件返回 typed error。 |
| [`config/embedding.ts`](../../packages/backend/src/config/embedding.ts) | 默认 download 已启用，固定模型 URL 已配置；阻止自动下载的直接原因是调用 policy，不是缺少默认来源。配置在启动时解析为用户级快照。 |
| [`embedding/service.ts`](../../packages/backend/src/modules/embedding/service.ts)、[`service.test.ts`](../../packages/backend/src/modules/embedding/service.test.ts) | `beginLoad()` 已立即返回，共享 `loading` promise；模型准备、进度、runtime 生命周期属于 daemon。旧 `beginLocal()` 会拒绝加入 configured 下载，且 preparation ID 只属于那条旧路径。 |
| [`client/client.ts`](../../packages/backend/src/client/client.ts) | `loadModel()` 每 250 ms 轮询至 ready，下载无整体等待上限；旧 `prepareLocalModel()` 也会等待到 startup deadline，不能支持短暂观察后返回。 |
| [`coordination/coordinator.ts`](../../packages/backend/src/coordination/coordinator.ts) | 只在 `backend.unavailable` 自动启动，验证身份后使用；query 首次明确 `embedding.not-loaded` 才 local prepare 并重发一次。其他错误不重放。 |
| [`index-runtime-client.ts`](../../packages/backend/src/coordination/index-runtime-client.ts) | CLI 轮询 index 至终态；首次 not-loaded 失败后在 CLI 准备模型，再提交一次 operation。CLI 提前结束会失去后续提交者。 |
| [`index/operation-service.ts`](../../packages/backend/src/modules/index/operation-service.ts) | daemon 已拥有 operation id、进程内状态和异步执行；全局一个 active operation，其余返回 `backend.busy`。没有持久队列或跨重启恢复。 |
| [`install-command.ts`](../../packages/cli/src/install/install-command.ts)、[`sync-semantic-index.ts`](../../packages/cli/src/install/sync-semantic-index.ts) | canonical commit 后同步 build。`indexSync` 只有 ready/failed；Pack 已提交时仍 `ok: true`，派生失败不回滚。 |
| [`index-commands.ts`](../../packages/cli/src/index/index-commands.ts)、[`output/protocol.ts`](../../packages/cli/src/output/protocol.ts) | index CLI 成功 schema 只接受 ready；stdout 是一个 JSON envelope，失败只有 code/message；进度不能混进 stdout。 |
| [`Engine index service`](../../packages/engine/src/query/semantic/index/service.ts)、[既有 index 设计](./index-runtime-and-install-sync-design.md) | Engine 决定 no-op、metadata-only 和编码范围；失败 staging 不替代 active index，发布受 Store snapshot fence 保护。 |

现有 [dependency boundaries](./semantic-query-v1-dependency-boundaries.md)、[roadmap](./query-roadmap.md) 将持久任务队列、CLI 退出后的可靠补偿和前后台调度定位为 #115。本次仅确认本地文档对该 issue 的定位，没有把远端 issue 的未读取内容当作新需求。

## Required：验收目标

1. 缺少固定模型时，首次需要 embedding 的 query、index 或 install 自动触发后台下载，沿用用户 download 配置；不要求先运行 `lore model load`。
2. 普通命令不等待完整模型下载，也不以传输总时长作为前台执行时间。前台取消只取消等待；已接受任务继续。
3. pending 与 ready 必须在机器结果中可区分。正在下载不能报告为 ready，也不能把 query 空结果冒充成功。
4. install 已提交的 Pack 不因模型或派生索引失败而回滚。install 返回 pending 时，Backend 必须确实已经接受后续 build。
5. 自动下载只下载固定公共模型资源；不会把 Practice 或 query 发往远端。keyword 路径继续离线。status 不触发启动、下载或构建。
6. Engine 仍拥有检索、增量和发布规则；Backend 拥有模型和执行生命周期；CLI 保持薄协议边界。

“非阻塞”在这里指模型准备和 index 后处理不占用长期前台等待。正常 query 编码、Backend 启动和 install 的 Pack 获取/提交仍有各自原有期限。起步采用 **1,000 ms 结果观察预算**，这是 Proposed 的实验参数：使用延迟注入和编译版验收校准，不将其描述为已测得的产品 SLA。预算必须覆盖重复轮询，不能每次 poll 或模型阶段重新计时；Backend 启动仍遵循原 startup deadline。

## Proposed：共享模型准备

把现有 prepare-local 协议泛化为 `POST /internal/v1/model/prepare` 和 `GET /internal/v1/model/preparations/:preparationId`，启动或加入一次 configured preparation，并立即返回状态。复用 `ModelStatus`、`ModelProgress` 及其 downloading/verifying/starting 阶段。不要新增下载器、缓存库或第三方 queue 依赖：现有实现已覆盖传输、续传、校验和与互斥，本阶段缺的是准入与 waiter 生命周期。

以下接口均为建议合同，具体文件组织沿用当前 feature 目录：

```ts
interface ModelPreparation {
  preparationId: string;
  status: ModelStatus;
}
interface ModelPreparationService {
  begin(): ModelPreparation; // 同步准入；后台任务属于 service
  get(preparationId: string): ModelPreparation;
  wait(preparationId: string): Promise<ModelStatus>; // 仅供 daemon continuation
}
interface BackendClient {
  beginModelPreparation(options?: BackendRequestOptions): Promise<ModelPreparation>;
  modelPreparation(id: string, options?: BackendRequestOptions): Promise<ModelPreparation>;
}
```

`begin()` 不承担完整文件验证或网络等待，立即登记 id 和 loading 状态后启动异步任务。同一 daemon 的自动准备、显式 `model load`、并发 query 和 index 共用一次准备；不得因调用入口不同拒绝加入正在下载的任务。`model load` 保留用户主动等待至完成的语义，复用相同 begin/status 协议及 stderr 进度。

实现明确删除 `local-only`，避免同一模型出现两套准入、并发和下载语义。`download.enabled: false` 保持显式禁用；自定义 `modelPath` 仍是权威输入，缺失或损坏时不偷偷改用另一文件。校验失败、权限错误、不支持续传等真实失败仍返回已有 typed error。

状态使用现有 unloaded/loading/ready/failed/unloading。preparation id 在每次新准备产生，unload 或 daemon 重启后失效。模型 ready 时 begin 返回 ready 观察值；同一 loading 的 id 稳定。正常读取状态不重试失败任务，避免并发 poll 引发下载风暴；新的显式 `model load` 可按现有规则重试。自动下载失败后普通 semantic 命令呈现该错误，并给出 model load 重试入口，本阶段不新增无限重试或定时恢复策略。

## Proposed：query 的结果

query 继续先调用 Engine，使 index 不存在/不兼容等错误保持优先级，避免无可查询 index 时下载模型。首次明确 not-loaded，或确认属于模型 preparation 的 loading 状态时，coordinator 调用 begin 并短暂观察。预算内 ready 则按已有安全边界重新 query 一次；仍 loading 则返回一个可识别的阻塞结果：`ok: true`、退出码 `1`、`data.state: "preparing"`。这表示请求已被接受但本次没有检索结果，不是普通失败；CLI 已有 exit 1 的 domain-result 机制，可避免把后台准备伪装成 exit 2 的运行错误。

```json
{
  "ok": true,
  "data": {
    "state": "preparing",
    "preparationId": "<uuid>",
    "message": "The local model is preparing in the background. Check lore model status, then retry this query."
  }
}
```

示例省略既有 envelope 元数据。`query` 的 result schema 扩展为 semantic result 与 preparing result 的 union；全局 failure schema 不变。preparing result 表示此次没有 query 结果、后台已开始或已加入模型准备，不表示下载失败。query 内容不排入后台，也不在 CLI 退出后重放。native 正在编码等真正的 `embedding.busy` 保持 busy，不能一概当 preparing。

必须让自动与显式 preparation 的 loading 都有相同识别语义。HTTP/typed error 的改动集中在 Backend query adapter；Engine 不认识下载状态，只表达 embedding 能力尚不可用。

## Proposed：index 和 install 的延续

将 not-loaded 后的准备与至多一次重新 build 从 CLI coordinator 移入 Backend index operation 编排。否则 CLI 返回 pending 后无人负责继续。这是执行生命周期归位，不是将 Engine 的增量算法移到 Backend。

```ts
type IndexOperation =
  | { operationId: string; state: "building" }
  | { operationId: string; state: "preparing"; preparationId: string }
  | { operationId: string; state: "ready"; index: IndexStatus }
  | { operationId: string; state: "failed"; error: IndexOperationErrorCode };

interface IndexRuntimeClient {
  build(root: StorageRoot, wait?: RuntimeWaitOptions): Promise<IndexOperation>;
  rebuild(root: StorageRoot, wait?: RuntimeWaitOptions): Promise<IndexOperation>;
  // 返回观察预算内的最新状态；非终态不再被当作协议失败。
}
```

Backend 第一次直接执行 Engine build/rebuild，保留 no-op、空集、metadata-only 无须模型的能力。只有确定该尝试以 not-loaded 失败且没有发布 active index，才转 preparing 并加入共享模型准备。准备完成后用同一 operation id 重新执行一次 Engine 用例，重新获取 Store 快照。失败的 staging 必须先清理，不得持有 Store mutation lock、snapshot fence 或 index writer lock 等待下载。第二次失败直接成为 operation failed。

业务 operation 与模型 preparation 是两个生命周期：多个调用可以共享模型准备，但不会因此重放、合并或覆盖 index 操作。维持现有全局一个 active index operation；preparing 也占该业务槽，其余请求迅速得到 busy。本阶段不声称每个并发 install 都能排队成功。长下载阻止其他 index 被接受是可见代价，跨 Store 公平调度属于 #115；已有 index 的 query 仍按当前 native 单槽规则执行。

CLI `index build/rebuild` 成功 schema 扩展到 preparing/building/ready；非终态 `ok: true`、退出码 0 只表示请求已被 Backend 接受，必须含 operationId。stderr 提示后台继续。新增 `lore index operation <operationId>` 只查询该 operation 的当前状态，不启动 Backend；现有 `index status` 继续回答 Store 的真实派生数据状态，不能用 pending 覆盖真实 ready/stale/missing。

install 在 canonical commit 后仍提交普通 build，观察预算结束后映射为：

```ts
type InstallIndexSync =
  | { state: "ready"; index: IndexStatus }
  | { state: "pending"; operationId: string; phase: "preparing" | "building" }
  | { state: "failed"; error: { code: string; message: string } };
```

ready 仅表示该 operation 已确认 ready；pending 必须关联实际接受的 operation；无法连接、被 busy 拒绝、下载已失败等为 failed。三者均不更改 Pack canonical 成功的 `ok: true`/退出码 0。所有成功 install（含幂等）仍提交一次 build；不借这次变更增加 upgrade CLI。

## 生命周期、一致性与失败

| 场景 | 明确行为 |
| --- | --- |
| CLI 在成功准入后退出或被取消 | daemon 模型任务和 index continuation 继续；仅 waiter 停止。 |
| CLI 未收到准入响应 | 结果未确认，不盲目重提；提示查询 Store/index 状态。没有幂等提交键之前，不承诺重试同一业务操作。 |
| 下载中 daemon 正常停止或崩溃 | 现有 `.part` 保留；下次实际需求重新准备可续传。进程内 operation/id 消失，不声称自动重启 daemon 或自动恢复索引目标。 |
| 旧 operation id 在新 daemon 查询 | 新增 `backend.operation-expired`，提示检查 index status 后按需 build；不能把未知 id 当成功。 |
| 模型准备失败 | 所有等待该 preparation 的 index operation 以原 typed error failed；query 下次调用看到具体失败。 |
| 用户显式 unload/stop | 中断准备并释放资源；等待 operation 变 failed，或随 daemon 退出失效。不能由 continuation 在明确 stop 后自动复活服务。 |
| 下载期间 Store 再次 mutation | continuation 重新获取当前快照；Engine 决定 delta/full rebuild，并通过现有 fence 发布。canonical 为事实来源。 |
| 运行期跨 worktree 身份不匹配 | 保持 `backend.incompatible` 等既有校验，不停止或接管其他 build 的 Backend。 |

下载仍以 artifact digest 为缓存身份，沿用现有跨进程文件锁，不靠 preparation UUID 替代文件互斥。Backend restart 后不复用旧内存状态。operation 的成功只证明它发布/确认的快照，之后另一次 mutation 仍能使 index stale。

## 取舍、兼容与 #115

推荐复用 daemon 内的模型任务和 index operation，而不是在 CLI 等待下载。这样后台执行有现成所有者，同时满足 CLI 退出后同一 daemon 内继续完成的用户价值。

只后台下载、仍让 index 返回失败并要求人再 build，不能完成“install 后自动索引”的连续流程，因此不选。现在直接建设持久队列也不选：它需要 Store 目标登记、重启恢复、投递幂等、调度和过期策略，超出修正自动准备所需范围。

本阶段与 #115 的分界是**同一 daemon 内已接受任务继续执行**与**跨退出/崩溃的可靠目标追赶**。前者现在实现；后者保留 index operation 入口作为将来 durable scheduler 的调用边界。需要保证每次 Pack mutation 最终追赶、Backend 自动重启恢复、多个 Store 排队或 foreground 优先级时，必须进入 #115；不能将当前 pending 宣传成持久任务成功入队。

这是 CLI 结果合同扩展：严格依赖 index 成功必为 ready、install 仅 ready/failed 的调用方必须更新。command result/discovery schemas、typed error tables、DTO/client 及文档应同批修改；全局 envelope 结构仍为版本 1。Backend 身份/协议兼容性必须沿用现有机制，确保旧 client 不会静默接受不认识的状态。

不增加磁盘任务 schema，不需要数据迁移。回退代码后 canonical/index 文件仍兼容，但回退前需结束新 daemon；不能要求旧 binary 解释新进程的 operation。模型缓存及完整 `.part` 仍由原校验/续传合同处理。

## 分阶段实施与验收

1. 统一 preparation 准入与立即返回接口，修改自动路径 policy。验证显式 load 与自动准备共享同一任务、下载继续、失败可见、配置禁用生效；这是后续非阻塞语义的内部前置。
2. 实现 query 短观察与 preparing 错误；把 index continuation 移到 daemon，同一 operation 跨准备继续。同步扩展 CLI pending 与 operation 查询，交付缺模型也能自动完成安装后索引的路径。
3. 更新此前禁止自动下载和 install 必等终态的文档/AGENTS 指导，执行针对性测试、typecheck、lint、格式检查；构建 runnable release staging，用隔离 Store 验收，并交付用户可直接运行的命令。

行为验收至少覆盖：

- 使用暂停的模拟下载：触发 ordinary semantic 请求后 CLI 在观察预算加协议开销内返回；保持传输未完成，证明返回不依赖模型 ready。记录 Backend 启动、请求准入、观察等待三段耗时，避免把启动时间误算成下载阻塞。
- CLI 已退出，释放模拟下载，确认模型 ready；index/install 接受的同一 operation 自动 ready，真实 semantic query 能检索安装内容。stdout 始终只含一个 JSON；阶段进度只出现在 stderr。
- 并发自动请求和显式 load 只产生一次下载与 runtime start；已有 downloading 对 query 表现为 preparing；native 正忙仍返回 busy。
- ready/空集/纯删除/metadata-only 路径不准备模型；已有模型但加载慢也受前台观察预算约束。
- 下载失败、disabled、自定义模型坏校验、unload、断连、daemon 重启/id 失效均有测试；重启后续传成功不等于旧 index operation 已恢复。
- 注入第一轮部分编码后 not-loaded，证明原 active 保留、staging 释放，等待期间 Store 可提交；第二轮读取新快照，仍受原发布 fence 保护。
- index pending 与 install pending 均能用 operation id 查到状态；被 busy 拒绝或响应未确认时绝不制造 pending id。
- 构建前运行 `bun run build:native`；embedding 编译版使用 `bun run build:release-staging`，不用只有 CLI 的 binary 充当 embedding 候选。验证全部使用隔离 Store，不清除用户模型缓存或接管身份不同的 Backend。

实现后的单元、协议和 CLI 测试覆盖了自动/显式 preparation 共享、短观察、query preparing、index continuation、install pending、失败映射和 Store/index 不变量；完整的真实下载耗时与观察预算校准仍需要独立记录。持久恢复、自动后台 retry、公平调度和更大规模性能优化为 Deferred，不是本阶段交付门槛。
