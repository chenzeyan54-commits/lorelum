# Drizzle ORM 引入：持久化层重构设计

- 日期：2026-09-14
- 关联：[Issue #58](https://github.com/lorelum/lorelum/issues/58)
- 状态：设计已根据“以代码管理和分层为主目标”的方向重写；尚未安装依赖或修改生产代码。

## 结论

建议在 public alpha 阶段引入 Drizzle，并把它定义为一次 **持久化层重构**，不是一次“把 SQL 改写成 query builder”的尝试。

目标是让 schema、migration、连接、transaction、行映射和数据库专用操作都拥有明确的归属。当前已经有 `model/`、`storage/` 和 `lifecycle/` 目录，但 `bun:sqlite` 的 `Database` 仍穿透到 lifecycle；semantic service 同时负责 embedding、打开/关闭 SQLite、完整性检查和 staging 文件发布。这使得数据库规则无法在一个稳定边界内演进或测试。

采用 Drizzle 后，Engine 的三类 SQLite 持久化应使用**同一套** connection factory、read/write session、migration runner、staging publisher 和测试夹具：

- LocalStore 的关系数据；
- keyword index 的 metadata 和 FTS5 adapter；
- semantic index 的 metadata、vector rows 和发布 adapter。

每个物理数据库仍有自己的 schema 与 **一份 init migration**，因为它们独立创建、版本化、重建和恢复；这不代表每个服务各写一套连接和迁移框架。统一的是执行机制和代码管理，分开的是数据生命周期。当前 alpha 不维护旧 schema 的升级历史：遇到旧持久化状态就清理并以当前 baseline 重建。

这不要求消灭原生 SQL。Drizzle 支持把参数化 SQL 作为受控 escape hatch；`MATCH`、`bm25`、FTS5 virtual-table DDL、`PRAGMA` 和少数高性能批量操作可以继续存在，但只能封装在 persistence adapter 内。业务 lifecycle、query service 和 Backend controller 不再直接持有 `Database` 或拼接 SQL。

Backend startup lock 不需要为了“全都 ORM 化”而虚构一张锁表。它应成为独立的 `ExclusiveLock` 协调接口，当前 SQLite `BEGIN IMMEDIATE` 是其一个小而可靠的实现。

## Observed：当前分层的缺口

### 数据库资源泄露到用例层

- `local-store/lifecycle/mutation.ts` 的 mutation context 直接暴露 `Database` 并自行打开连接；
- `local-store/lifecycle/open.ts` 和 `recovery.ts` 的 callback 直接接收 `Database`；
- `query/semantic/index/service.ts` 同时组织 embedding、Store snapshot fence、`new Database`、完整性校验、close 和 rename；
- `query/keyword/persistent-keyword-index.ts` 混合 checkpoint SQL、transaction、writer lock 和临时文件发布。

结果不是“没有目录”，而是数据库资源、SQL、文件发布和领域编排仍在同一个函数链里交叉出现。新增一张表或一条约束时，维护者必须从 schema、SQL 字符串、行类型、lifecycle 事务和测试中自行找齐影响面。

### 三种 SQLite 使用方式有不同语义，但应有同一种管理纪律

| 数据库 | 事实来源与主要职责 | ORM 应承担的部分 | 仍需专用实现的部分 |
| --- | --- | --- | --- |
| LocalStore | Pack artifact/manifest 的一致投影 | schema、migration、关系读写、transaction session、row mapping | canonical/digest 校验、跨介质 journal/recovery |
| keyword index | 可从 Store 重建的 FTS5 派生 index | metadata schema、连接、生命周期和 repository 边界 | virtual-table DDL、`MATCH`、`bm25`、分词和 ranking |
| semantic index | 可从 Store + Profile 重建的向量 index | metadata/vector schema、CRUD、batch transaction、repository | Float32 编解码与校验、staging/rename 发布、snapshot fence |

因此，FTS 和 vector 不是 ORM 分层的例外；它们只是需要 repository 内原生 SQL/codec/publisher 的数据库。

## Proposed：目标边界

```text
packages/engine/src/
  persistence/
    database/
      connection.ts                # 唯一 bun:sqlite + Drizzle 创建/释放入口
      session.ts                   # readonly/write session 与 transaction
      migrator.ts                  # 唯一 init migration / baseline 初始化机制
      index-files.ts               # staging / seal / close / rename / cleanup
      testing.ts                   # persistence fixture 与故障注入
    schemas/
      local-store.ts
      keyword-index.ts
      semantic-index.ts
    migrations/
      local-store/                 # Drizzle Kit 输出：metadata + <timestamp>_init SQL
      keyword-index/               # 同上；唯一 init SQL 含 FTS5 custom DDL
      semantic-index/              # 同上
    definitions.ts                 # 三个 typed database definition
    repositories/
      local-store/
      keyword/
      semantic/
      vector-codec.ts

  local-store/
    model/                         # 纯领域规则；不依赖 Drizzle
    lifecycle/                     # install / open / recovery / reindex 编排
  query/
    keyword/                       # projection、tokenizer 和 query 用例
    semantic/                      # profile、encoding、index/query 用例

packages/engine/
  drizzle.local-store.config.ts
  drizzle.keyword-index.config.ts
  drizzle.semantic-index.config.ts

packages/backend/src/runtime/coordination/
  exclusive-lock.ts                # Backend 只依赖此接口
  sqlite-exclusive-lock.ts         # BEGIN IMMEDIATE 实现
```

不要新增泛型 `BaseRepository` 或 `getDatabase(name: string)` 一类全能 manager。统一 factory 只接收编译期确定的 database definition；业务层只注入 `StoreRepository`、`KeywordIndexStorage` 或 `SemanticIndexStorage` 这类窄接口。

### 统一管理，不等于立刻合成一个物理 SQLite 文件

统一平台的最小合同如下：

```ts
interface SqliteDatabaseDefinition<Schema> {
  readonly id: "local-store" | "keyword-index" | "semantic-index";
  readonly schema: Schema;
  readonly migrationsFolder: URL;
  readonly legacyPolicy: "reset-and-hydrate" | "discard-derived-index";
  readonly openPolicy: "migrate-on-write" | "validate-readonly";
}

interface SqlitePersistenceFactory {
  withWrite<T, Schema>(
    definition: SqliteDatabaseDefinition<Schema>,
    location: SqliteLocation,
    run: (session: SqliteWriteSession<Schema>) => Promise<T>,
  ): Promise<T>;
  openRead<Schema>(
    definition: SqliteDatabaseDefinition<Schema>,
    location: SqliteLocation,
  ): Promise<SqliteReadSession<Schema>>;
  createStaging<Schema>(
    definition: SqliteDatabaseDefinition<Schema>,
    location: SqliteLocation,
  ): Promise<SqliteStagingSession<Schema>>;
}
```

factory、session、migrator 与 index-file publisher 都只有一份实现。每个 definition 只声明自己的 schema、Drizzle Kit 输出目录和读写策略。当前每个输出目录只含一条 init migration；运行时统一调用 Drizzle 的 `migrate()`，由 Drizzle 记录已执行版本并只执行未执行的 SQL。本阶段不携带旧 `PRAGMA user_version` 或历史升级脚本；各物理 SQLite 文件可以独立创建或丢弃，初始化代码和规则不再复制。

### Migration 的生成与运行

这不是“应用启动时把一组 SQL 从头跑一遍”，也不使用对真实用户文件直接 diff 的 `drizzle-kit push`。

1. `persistence/schemas/*.ts` 是普通关系表的 source of truth。
2. 每个 database definition 用独立 Drizzle Kit config 执行一次 `generate --name init`，把生成的 SQL、snapshot 和 journal metadata 提交到仓库。
3. keyword 的 FTS5 virtual table 不伪装成 `sqliteTable()`；在**首次提交且尚未执行**的 keyword init SQL 中追加经审查的静态 `CREATE VIRTUAL TABLE ... USING fts5`。之后不修改这条 migration；FTS schema、`MATCH` 和 `bm25` 由 keyword repository 和 SQLite 集成测试拥有。
4. `persistence/database/migrator.ts` 是唯一运行入口：它把新建的 LocalStore `.next` 文件或 index staging 文件交给 Drizzle `migrate()`。迁移完成后才进入业务 transaction 写 projection 或 index rows；不把 migration 嵌套进业务 transaction。
5. read-only active index 不运行 migration，只验证它已处于当前 baseline。legacy 文件先走本节定义的 reset，而不是交给 Drizzle 接管。

Drizzle 的运行时 migrator 需要读取生成的 migration 目录。因此 release/compiled CLI 必须把三套 migration assets 一并打包，并以可执行文件可定位的路径传入 factory；不能依赖仓库 cwd 或用户机器上的源码目录。

当前的物理布局仍应保留：

- LocalStore 是每个 Store root 的 `store.sqlite`；
- keyword index 是 `indexes/keyword/v<version>/active.sqlite`；
- semantic index 是每个 Store root、每个 Profile 的 `indexes/semantic/v<version>/<profile>/active.sqlite`；
- Backend 的 `control.sqlite` 是 user-level 的进程互斥原语，不属于 Engine 的领域数据库。

这不是因为 SQLite 很轻，所以无需统一；恰好相反，SQLite 的文件边界使我们能用同一 factory 管理多个独立生命周期。保留 Store、keyword、semantic 三个物理文件的主要原因是：index 可以在 staging 中完整构建并原子替换，失败或重建不会影响 Store；semantic 还能按 Profile 独立失效和重建。

合成一个物理数据库在技术上可行，但会改变发布协议：必须在同一库内维护 staged generation、active generation 指针、旧 generation 回收和大事务/WAL 策略，不能再通过替换整个 active index 文件发布。它是一个独立的架构决策，不是“统一代码管理”的前置条件。alpha 可以选择做它，但当前没有必要先承担这次发布协议重写。

### 最小持久化合同

```ts
interface StorePersistence {
  read<T>(run: (session: StoreReadSession) => T): T;
  write<T>(run: (session: StoreWriteSession) => T): T;
  close(): void;
}

interface KeywordIndexRepository {
  search(input: KeywordSearch): readonly KeywordCandidate[];
  applyChanges(change: KeywordIndexChange): void;
}

interface SemanticIndexBuildSession {
  findReusable(practiceId: string): SemanticVectorRecord | undefined;
  upsert(records: readonly SemanticVectorRecord[]): void;
  validateAndSeal(metadata: SemanticIndexMetadata): SealedIndex;
  dispose(): Promise<void>;
}

interface ExclusiveLock {
  withLock<T>(scope: string, timeoutMs: number, run: () => Promise<T>): Promise<T>;
}
```

`StoreReadSession` 和 `StoreWriteSession` 不暴露 Drizzle instance、`Database` 或 `.select()`。它们只提供 LocalStore 实际需要的读写动作；同一个 write session 会把 Practice、source、revision、outbox 和 metadata 的更新放进同一 transaction。

## 原生 SQL 在新结构中的位置

### 不需要脱离 ORM 才能写检索 SQL

此前“FTS 必须原生写，所以不适合 ORM”的判断不准确。需要原生表达的是 **SQLite 特有的检索语义**，而不是脱离持久化层。

Drizzle 的 `sql` template 可执行参数化原生 SQL，也可组合进 ORM 查询。keyword 的 `MATCH`、`bm25` 和 FTS5 virtual-table DDL 可以由 `KeywordIndexRepository` 的 custom init DDL 和 `search()` 使用；调用方只得到 `KeywordCandidate`，不知道 SQL、连接或 FTS 表名。

这带来的收益是：schema/migration/connection/transaction 统一管理，专用 SQL 被限制在一个可审查文件，而不是出现在 lifecycle 或 CLI 路径。需要继续审查的是 ranking 语义和 `EXPLAIN QUERY PLAN`，不是“SQL 是否仍存在”。

### ORM 可以管理向量存储，不能替项目决定向量合法性

`semantic_vectors` 是普通 SQLite BLOB 表。Drizzle 可以管理 metadata/vector schema、行的读写、批量 transaction 和 init DDL；`VectorCodec` 负责将 `Float32Array` 与 BLOB 转换，并验证维度、有限值和 L2 normalization。

同理，ORM 不会自动替 Lorelum 证明“这个 index 对当前 Store snapshot 和 Profile 是安全的”。这属于 `SemanticIndexService` 的 Store fence 决策和 `SemanticIndexStorage` 的 staging/rename 资源管理。新分层的目标不是把这些规则交给 ORM，而是把它们从 SQL/文件细节中分离出来，使每个规则有唯一所有者。

## 从 semantic index 到 semantic query：怎样组织代码

这条链覆盖两个真实用例：index build/rebuild 负责把一个一致的 Store 快照变成可发布的向量 index；默认 semantic query 负责生成 query embedding、读取 index candidate，再从同一 Store 身份回读 Practice。ORM 的职责是收敛持久化代码，不是取代 embedding 或 ranking。

```text
lore index build / rebuild
  CLI -> Backend client -> IndexOperationService
      -> SemanticIndexService
          -> LocalStore snapshot / revision history
          -> EmbeddingPort
          -> SemanticIndexStorage
              -> unified SQLite/Drizzle factory
                  -> SemanticIndexBuildSession
                      -> SemanticIndexRepository + VectorCodec
              -> Store snapshot fence -> atomic rename

lore query <text>  (default semantic)
  CLI -> Backend query controller -> SemanticQueryService
      -> EmbeddingPort
      -> SemanticIndexReader
          -> read-only SemanticIndexRepository
      -> LocalStore readEffectivePracticesAtSnapshot
      -> assembled query hits
```

### 每层只管一件事

| 位置 | 负责什么 | 明确不负责什么 |
| --- | --- | --- |
| IndexOperationService | Backend operation ID、模型准备、状态轮询和错误映射 | index schema、向量写入、ranking |
| SemanticIndexService | full/incremental build 选择、Store snapshot/delta、embedding、何时允许 publish | 连接、SQL、rename |
| SemanticIndexStorage | 语义 index 的 staging、close 后 publish、失败清理；内部复用统一 index-file 机制 | 哪些 Practice 应重新 embedding |
| SemanticIndexBuildSession | 一个 staging SQLite 内的 metadata/vector 原子持久化和完整性检查 | Store 读取、模型调用 |
| SemanticIndexRepository | metadata/vector schema、批量读写、可复用向量、只读 scan | Float32Array 合法性、Store 业务规则 |
| VectorCodec | Float32Array 与 BLOB、维度、有限值、L2 normalization | SQL、文件发布 |
| SemanticIndexReader | 已验证 index 的 exact-scan candidate selection | 打开连接、Store snapshot 验证、CLI 输出 |
| SemanticQueryService | query embedding、读 index、按 index identity 回读 Store、组装结果 | SQLite、BLOB、SQL |

Backend 只管理模型和 operation 生命周期；Engine 继续拥有检索和 Store 一致性。Drizzle 只出现在 Engine 的 persistence adapter，Backend controller 不会变成第二套检索实现。

### 目标目录

```text
packages/engine/src/query/semantic/
  profile.ts
  encoding.ts                         # EmbeddingPort + 输入/输出验证
  projection.ts                       # EffectivePractice -> SemanticDocument
  query-service.ts                    # semantic query 用例
  index/
    service.ts                        # full/incremental build 决策
    reader.ts                         # 面向 query 的 domain reader

packages/engine/src/persistence/
  schemas/semantic-index.ts
  migrations/semantic-index/          # Drizzle Kit init SQL + metadata
  repositories/semantic/
    storage.ts                        # SemanticIndexStorage facade
    repository.ts                    # metadata/vector CRUD、批量读写
    vector-codec.ts                  # BLOB <-> Float32Array
    native-sql.ts                    # PRAGMA integrity_check 等专用 SQL
```

index/service.ts 只能依赖 LocalStore、EmbeddingPort 和 SemanticIndexStorage。它不能 import Drizzle、Database 或文件系统 API，因此能用 fake port 测 full/incremental 决策。

### schema、repository 和 vector codec

metadata 和 vector rows 是普通 SQLite 数据，适合由 Drizzle 统一定义和迁移；BLOB 的领域含义由 codec 处理。

```ts
// persistence/schemas/semantic-index.ts
export const semanticIndexMetadata = sqliteTable("semantic_index_metadata", {
  singleton: integer("singleton").primaryKey(),
  indexVersion: integer("index_version").notNull(),
  rootBinding: text("root_binding").notNull(),
  effectiveRevision: integer("effective_revision").notNull(),
  profileId: text("profile_id").notNull(),
  dimensions: integer("dimensions").notNull(),
  vectorCount: integer("vector_count").notNull(),
});

export const semanticVectors = sqliteTable("semantic_vectors", {
  practiceId: text("practice_id").primaryKey(),
  contentDigest: text("content_digest").notNull(),
  projectionDigest: text("projection_digest").notNull(),
  vector: blob("vector").notNull(),
});
```

```ts
// persistence/repositories/semantic/vector-codec.ts
export function encodeVector(vector: Float32Array, dimensions: number): Uint8Array {
  assertFiniteAndL2Normalized(vector, dimensions);
  return new Uint8Array(
    vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength),
  );
}

export function decodeVector(bytes: Uint8Array, dimensions: number): Float32Array {
  assertByteLength(bytes, dimensions);
  const vector = new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  assertFiniteAndL2Normalized(vector, dimensions);
  return vector;
}
```

repository 只接收经过 codec 的记录，并在同一个 transaction 内更新 vector rows 和 metadata：

```ts
export class DrizzleSemanticIndexRepository implements SemanticIndexRepository {
  constructor(private readonly session: SemanticIndexWriteSession) {}

  apply(change: SemanticIndexChange): SemanticIndexMetadata {
    return this.session.transaction((tx) => {
      if (change.removedPracticeIds.length > 0) {
        tx.removeVectors(change.removedPracticeIds);
      }
      if (change.records.length > 0) {
        tx.insertVectors(change.records.map(toVectorRow));
      }
      return tx.writeMetadata({
        ...change.target,
        vectorCount: tx.countVectors(),
      });
    });
  }

  findReusable(practiceId: string): SemanticVectorRecord | undefined {
    const row = this.session.findVector(practiceId);
    return row === undefined ? undefined : toSemanticVectorRecord(row);
  }
}
```

示例刻意让 session 封住 Drizzle 的精确调用；真正重要的是 schema、行映射、transaction 和 runtime codec 不再分散在 database.ts、reader.ts 与 service.ts。外部 service 永远不会拿到 BLOB、Drizzle row 或 Database。

### build：从 Store 快照到 active index

```ts
// index/service.ts：只编排领域步骤。
const snapshot = await store.readEffectivePracticeSnapshot(root);
const documents = snapshot.practices.map(projectSemanticPractice);
const vectors = await embedDocuments(embedding, profile, documents);

const staging = await semanticIndexStorage.createStaging(root, profile);
try {
  await staging.write({
    metadata: metadataFor(snapshot.identity, profile, documents.length),
    documents,
    vectors,
  });
  await staging.verify();
  await store.withSnapshotFence(root, snapshot.identity, () =>
    semanticIndexStorage.publish(staging),
  );
} catch (error) {
  await semanticIndexStorage.discard(staging);
  throw error;
}
```

- createStaging 通过统一 factory 创建文件、打开 Drizzle/bun SQLite session、运行 semantic index 的唯一 init migration。
- write 调用 codec 和 repository，在一个 SQLite transaction 内写 vector rows 和 metadata。
- verify 检查 metadata/vector 合同和 SQLite integrity。
- withSnapshotFence 只在 Store 仍为同一 identity 时授权 rename。
- publish 关闭 handle 后替换 active 文件。

SQLite transaction 只负责 staging 文件内部的一致性；SemanticIndexStorage 通过统一 index-file 机制负责文件系统发布协议。

### query：从 query embedding 到最终 Practice

当前 semantic ranking 是 exact scan：Reader 取出已验证的向量，在 Engine 内计算 cosine，再按 similarity 和 Practice ID 排序。它不是 SQLite vector extension 查询，因此不应为了使用高级 SQL 而把 cosine 塞回数据库。

```ts
// query-service.ts：不接触 SQLite。
const queryVector = await embedOne(embedding, profile, request.text);
const reader = await semanticIndexReader.open(root, profile);
try {
  const candidates = reader.search(queryVector, excludedPracticeIds, request.limit);
  const practices = await store.readEffectivePracticesAtSnapshot(
    root,
    reader.identity,
    candidates.map((candidate) => candidate.practiceId),
  );
  return assembleQueryHits(practices, candidates);
} finally {
  reader.close();
}
```

Reader 内部通过 read-only repository 获得 SemanticVectorRecord，而不是通过 Database.query 直接暴露行。Store 回读使用 index identity：即使 index candidate 存在，也不能把另一版 Store 的 Practice 混进结果。

### 高级自定义 SQL 在 semantic 中怎样处理

当前需要保留的专用 SQL 很少，主要是 PRAGMA integrity_check，以及未来 SQLite feature/extension 的 DDL。它们放在 persistence/repositories/semantic/native-sql.ts 或 semantic init SQL 中，返回 repository 所需的 domain 数据。

目前 exact scan 的用户 query 不进入 SQL；如果将来引入 SQLite vector extension 或 ANN，vector similarity SQL 也只能落在 SemanticIndexReader 和 repository 内。SemanticQueryService 继续只调用 reader.search，因此 CLI、Backend 和 Store 不需要感知底层从 exact scan 改成 ANN。

未来任何动态查询值都必须参数绑定；raw SQL 只能接收仓库维护的静态 DDL 或已经验证的 identifier。driver 返回的 BLOB 和 metadata 始终经过 codec/runtime validation。

### semantic 的测试分层

- vector-codec.test.ts：长度、NaN/Infinity、L2 normalization、BLOB round-trip。
- repository.test.ts：增量删除/插入/metadata 同一 transaction、可复用向量、row 损坏。
- publisher.test.ts：staging 失败保留 old active、close 后 publish、垃圾清理。
- index/service.test.ts：revision history、full/incremental 选择、snapshot fence、embedding 调用量。
- query-service.test.ts：index ready/stale/incompatible、query/store identity 重试、结果组装。
- integration：真实 SQLite integrity、Store mutation 与 build/query 交错、compiled release-staging。

这条链就是 ORM 分层最有价值的示例：每段代码只知道下一段的合同。将来替换 persistence baseline、vector layout、exact scan 或 ANN 时，影响被限制在 persistence/reader，而不是穿透 CLI、Backend、Engine service 和文件发布。

## Backend lock：保留机制，改善归属

当前 `withStartupLock()` 使用独立 `control.sqlite` 的 `BEGIN IMMEDIATE` 取得 SQLite OS writer lock；进程崩溃后锁会由 SQLite 释放。它没有领域数据，也没有 schema 管理问题。

更优雅的变化是让 Backend 调用 `ExclusiveLock.withLock()` 或 `StartupCoordinator`，把 SQLite 细节藏在 `sqlite-exclusive-lock.ts`。不建议仅为形式统一改用内存 mutex：它不能跨进程；也不建议未经三平台和 compiled binary 验证就引入原生 `flock`/文件锁依赖。socket bind 是 daemon 最终单实例裁决，但不能覆盖准备模型、写 runtime state 等整段启动操作的串行化。

Store 的文件 mutation lock 倒是另一个值得单独评估的对象：它有 PID reuse、`ps`/PowerShell、stale reclaim guard 等复杂恢复逻辑。若未来验证了跨平台的 OS-backed lock，可用同一 lock adapter 覆盖 Backend、Store 和 index writer；在此之前不要把它和 ORM migration 绑定为同一项改造。

## Alpha baseline：只初始化，重建 SQLite 投影

本次 alpha 明确选择 **purge-and-rebuild**，但清理对象是旧手写 SQLite 投影和派生 index，**不是 Pack artifact**。不做旧 SQLite schema 到 Drizzle 的桥接，也不维护两套 migration authority。

- **保留的权威数据**：sealed Pack artifact 保存 Practice 内容，manifest 决定当前哪些 artifact 生效；两者的格式不变，必须原样保留。它们是新 LocalStore 的重建输入。
- **检测与预检**：发现旧 `store.sqlite`、但没有当前 Drizzle baseline 标记时，判定为 legacy Store。在 Store mutation lock 下只核对 manifest 引用的每个 artifact 与 sealed projection；不读取旧 SQLite，也不解析或重放 legacy operation journal。manifest 与 artifact 能构成完整输入就重建；任一引用缺失或校验失败则返回 recovery required，不删除任何 Pack 数据。
- **清理范围**：确认权威数据完整后，只清理旧 `store.sqlite`（及 WAL/SHM）、旧 keyword / semantic index、旧 SQLite 内的 revision log/outbox，以及 legacy journal、staging/lock 残留。它们不再是新 Store 的输入。用户 config、模型缓存、Backend runtime 与 `control.sqlite` 不在此范围。
- **重建**：创建 `store.sqlite.next`，运行唯一的 Drizzle init migration，从保留的 manifest 和 sealed projection 写入 active packs、effective practices、sources 和匹配的 Store metadata；完整校验后原子替换旧 SQLite 文件。keyword 和 semantic index 按新版本重新建立。
- **失败语义**：清理或初始化中断时，旧 Pack artifact/manifest 仍在；下次打开再次从它们重建。新的 SQLite 投影完整初始化前，不允许把 Store 当成可读取状态。

这意味着本次切换不承诺保留旧 **SQLite projection 或 index**，但保留已安装 Pack。`effective_revision_log` 和 `effective_revision_outbox` 不转移：前者没有可继续消费的历史，后者不重放；新 Store 从保留 manifest 对应的当前 revision 开始，所有新 index 从完整 build 建立 checkpoint。

未来若表结构再改，仍维持这项 alpha 政策：要么 bump persistence baseline 并 reset LocalStore-owned 数据，要么在产品进入需要保留本地状态的阶段后，单独设计真正的 version-to-version migration。不能在两者之间悄悄补一段旧 SQL 升级逻辑。

## 实施顺序与验收

1. 建立统一 SQLite/Drizzle factory、session、init runner、index-file publisher 和三个 database definition；每个 definition 只生成一份 Drizzle Kit init migration，并验证 compiled CLI 可定位 migration assets。
2. 一次性切换 LocalStore 六张关系表，删除旧 migration/SQL 管理路径，并实现 legacy Store 检测、manifest/artifact 预检、SQLite projection reset/hydrate 和 reset-incomplete 恢复；验证 install、upgrade、uninstall、open、reindex 与 Pack 保留。
3. 让 keyword 和 semantic 通过同一 factory/init runner 管理各自的新版本文件；保留 FTS/vector 专用 SQL，但禁止 service 直接 `new Database`、close 或执行 SQL。
4. 抽取 Backend `ExclusiveLock`，保持现有 SQLite mutex 行为；不要把它伪装为 ORM entity。
5. 验证 SQLite transaction rollback、snapshot race、corruption、incremental/full index 等价性、staging 发布失败保留旧 index、崩溃锁释放，以及 `bun build --compile` 的 release-staging 路径。

本设计的验收不是“原生 SQL 数量归零”，而是：每个 SQLite 数据库都有唯一 schema/migration owner；用例层不接触连接和 SQL；数据库专用能力集中在可测试的 adapter；领域一致性规则没有因 ORM 而被稀释。

## Deferred

- 不在本次设计中定义 ORM 以外的通用 repository 框架。
- 不在未经跨平台实测前替换 Backend SQLite mutex 或 Store file mutation lock。
- 不改变 Pack format、CLI envelope 或 semantic ranking 合同；若 schema 切换影响它们，单独进行公共合同评审。
