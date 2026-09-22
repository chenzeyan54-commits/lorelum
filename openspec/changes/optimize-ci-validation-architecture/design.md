## Context

本设计只处理 GitHub Actions 的内部验证路径；动机和范围见
[proposal.md](./proposal.md)。它不改变 CLI、Pack、retrieval、Backend、格式或站点的公开合同。

### 已确认的运行链与瓶颈

当前 `.github/workflows/ci.yml` 只有一个 `verify` job，按以下顺序在
`ubuntu-24.04` 上执行：

```text
checkout -> bun install -> typecheck -> design:lint -> lint -> test -> build:site -> fmt:check
```

2026-09-22、commit `516e438140ab2928845f5661c854e757e662af98` 的 PR run
`35688880784` 从 job 开始到完成为 81 秒。其中 Typecheck 为 21 秒、Test 为 28 秒、
Build site 为 15 秒；其余静态检查单步不足 1 秒，安装约 4 秒。这个 run 是本设计的
基线证据，而不是以后改动的永久性能证明：每次候选变更都必须以相同 commit、lockfile、
runner 标签和命令重新采样。

当前根 `typecheck` 是：

```sh
bun run --filter '*' --parallel typecheck \
  && tsc --noEmit -p scripts/release/tsconfig.json
```

它会并行启动 10 个 workspace 的 `tsc --noEmit`，再检查 release scripts。根依赖的
`typescript` 是 5.7.2；`apps/site` 另有 6.0.3。Bun 在这里是脚本和进程启动器，并不是
TypeScript typechecker。`tsconfig.base.json` 的 workspace `paths` 直接指向各 package 的
`src`，因此多个独立 program 会重复加载相同的源码；当前没有 `incremental`、
`.tsbuildinfo`、`composite` 或 project references。

GitHub 标准 Linux hosted runner 的配置是 4 vCPU / 16 GB RAM；所以当前不受限的 10 个
`tsc` 进程不应被默认视作最优。它可能掩盖 compiler、CPU oversubscription 和重复 program
构建三种不同原因。当前 Test 的 `--parallel=4 --max-concurrency=3` 则分别控制 test file
worker 和 file 内明确可并发的测试，不能把它的结论套用到 Typecheck。

`oxlint 1.74.0` 与 `oxfmt 0.59.0` 已经是 Oxc 的原生快速工具；这次基线中 Lint 和 Format
check 都不是主耗时。`fmt:check` 仍按 ADR 0002 是 non-blocking signal，不能借性能工作改变
它的质量策略。

`main` 的 active ruleset 要求严格的 `verify` status check。顶层 workflow `paths` 过滤若使
workflow 未创建，会让 required check 缺失或持续 pending；因此任何选择策略都只能在已经启动的
`verify` 内部执行。`main` push 也必须保留完整验证。

### 设计驱动力

- PR 的等待时间应先从已测得的 compiler、test、site build 成本中消除，而不是把所有命令拆成
  并发 job 后再掩盖重复安装、队列和维护成本。
- 能跳过的验证必须能够证明没有依赖它的改动；无法分类、读取 diff 失败或出现未建模的 Git
  状态时，安全默认值是执行完整相关检查。
- TypeScript 7 已提供原生编译器路径，但升级会触及所有 TypeScript configuration 和可能经由
  构建工具间接使用的 TypeScript API。官方的加速承诺不是本仓库的兼容性或性能证明。
- CI 失败会阻止所有合并，故优先采用可逐步启用、可一提交回滚且不削弱 `verify` 的方案。

## Goals / Non-Goals

**Goals:**

- 用阶段级、可复现的 GitHub timing 证据确定实际最慢路径，并用同一标准评估每个候选优化。
- 在完整 typecheck 语义不变的前提下，验证 TypeScript 7 原生 `tsc` 与当前配置的兼容性及真实
  GitHub runner 收益；只有达到门槛才切换默认 compiler。
- 只对明确不影响 site 的 PR 变更跳过 `build:site`；test、typecheck、design lint、lint 和
  format 在本阶段仍保持全量执行。
- 使每个 PR 与 main push 始终生成并完成 `verify`，main 始终执行完整验证。
- 把 affected checks、cache、project references 和多 job 拓扑的采用条件写成可测量门槛，避免
  用未来可能性引入长期维护机制。

**Non-Goals:**

- 不因为 TypeScript 7 宣称更快就直接替换当前 compiler，也不允许某个 workspace 静默继续使用
  另一套 compiler 而被称作“已迁移”。
- 不在本阶段把 `bun test --changed`、workspace manifest graph 或单纯目录前缀作为全量
  test/typecheck 的权威选择器。
- 不为少于 1 秒的 lint / format 检查增加 changed-file 分支、缓存或新的第三方 action。
- 不在没有实测净收益前启用 `.tsbuildinfo` cache、project references、远端 cache 或拆分多个
  常驻 CI job。
- 不改变 branch rules、release workflow、格式检查是否 blocking 的既有策略。

## Decisions

### 1. 先记录可比较的阶段证据，再改变验证范围

每一次 performance claim 必须记录以下最小证据集：commit SHA、`bun.lock` 状态、Bun/TypeScript
版本、runner 标签、事件类型、各阶段命令、exit status 和 duration。比较同一候选时至少区分：

| 阶段 | 观测目标 | 使用方式 |
| --- | --- | --- |
| install | 依赖准备的净耗时 | 判断 cache 或多 job 的重复准备成本 |
| typecheck | compiler 与 workspace 调度耗时 | TypeScript 7 和 worker cap 的主指标 |
| test | file worker、fixture 和 test 内并发耗时 | 不与 typecheck 调度混为一谈 |
| build:site | 站点编译耗时或被保守跳过的原因 | 评估 selector 的 PR 平均收益 |
| design/lint/fmt | 静态工具的耗时与 exit | 只在它们成为可见瓶颈时重新设计 |

首选 GitHub Actions 已有的 step started/completed time 作为 job 级测量来源，避免为采样引入
会影响命令语义的 profiler。若 Actions UI 的秒级分辨率不足以比较 TypeScript 候选，再新增一个
内部 `scripts/ci` timing wrapper：它以参数数组启动原命令、用单调时间记录 duration、把结果写入
`GITHUB_STEP_SUMMARY`，并原样传播 child 的 exit code 与 signal。wrapper 自身故障必须让该步骤
失败，绝不能把未执行的检查记录为成功。

采样策略是同一候选在 GitHub Linux runner 上至少取得 3 次无并发改动的结果，以中位数而不是一
次快 run 作决定。排队时间、checkout 后的 service jitter 和无关步骤不能被归因给 compiler。
本地 macOS 结果只用于筛掉明显更慢的候选，不能替代 GitHub 结论。

### 2. 将 TypeScript 7 原生 compiler 作为有明确回退的兼容性与性能 spike

TypeScript 7 的原生实现值得优先验证，因为它直接针对当前最大的静态检查成本；但本仓库当前的
5.7.2 root compiler、site 的 6.0.3 和 source `paths` 不能靠版本号推断兼容性。spike 必须在隔离
候选分支或 worktree 中完成，不能先修改 default CI 再收集证据。

#### 编译器入口与所有权

候选必须让每一个 CI typecheck config 都由同一个经过验证的 native `tsc` 可执行文件运行：9 个
`packages/*/tsconfig.json`、`apps/site/tsconfig.json` 和 `scripts/release/tsconfig.json`。不能继续
通过 `bun run --filter` 隐式依赖各 workspace 的 `PATH`，因为这样 `apps/site` 可能仍解析自己的
TypeScript 6 binary。实现时可保留 package-local script 供开发者使用，但 CI 的集中 typecheck
入口必须显式定位候选 compiler，并把每个 config 路径作为参数传入。

官方 TS 7 migration 指引允许 native `tsc` 与仍依赖 JavaScript TypeScript API 的工具并存。故
spike 还必须盘点直接依赖和 build-time 间接依赖：仓库代码、Vite/site build、design lint、测试和
release scripts。CI typecheck 的 compiler 切换不等同于可以删除其他工具实际需要的 JavaScript
TypeScript package。

#### 兼容性门槛

每个候选必须同时满足以下条件，才有资格成为默认 compiler：

1. 对上列全部 11 个 config，candidate 和当前入口的 exit status 完全一致；当前全部通过时，使用
   不提交的最小负向 fixture（继承同一 base config 并包含确定的类型错误）确认两者都会失败，避免
   用“两个 zero-exit”误判为等价。
2. 候选不得遗漏 config、忽略 `extends`、改变 `paths` resolution 或以 `skipLibCheck` 之外的方式
   隐藏现有诊断。对每个 config 保存 `--showConfig`/file-list 覆盖对照；允许 compiler 自带 lib 的
   路径不同，但 source include 集不得缩小。
3. 候选 lockfile 下的完整 `verify` 成功，包括 Test、site build、design lint、lint 和 format
   check；这覆盖直接或间接依赖 TypeScript API 的工具。
4. 先在本地通过完整性检查，再在 `ubuntu-24.04` 采样 3 次。Typecheck 中位数相对当前可比基线
   至少降低 30%，且完整 job 中除预期 Typecheck 变化外没有超过 5% 的可重复退化。

30% 是引入 compiler migration 的最低净收益，而不是 TypeScript 7 的性能承诺。若兼容性出现未
解释差异、候选在 GitHub 上未达门槛、或性能改善被 setup/lockfile 开销抵消，则不升级默认
compiler，删除候选 lock/script 改动，并把发现作为后续跟踪证据。

#### 进程数不是默认结论

当前 `bun run --parallel` 无上限地发起 10 个 workspace scripts。spike 的基线须额外测量当前
JavaScript compiler 在 `1, 2, 3, 4, 10` 个 typecheck worker 下的耗时和峰值内存；再以表现最好的
可比 worker cap 复测 native compiler。生产实现只在 winner 相对当前无上限调度有至少 10% 的
可重复收益、没有 memory/flake 退化时，才引入一个最小的受限 workspace scheduler。否则保留
现有脚本，不为一个未经证实的 cap 添加脚本、配置和失败分支。

这里的 scheduler 只拥有“并发运行已明确列出的 typecheck configs”的责任；它不拥有依赖分析、
cache、重试或 diagnostics 过滤。任一 child 失败后仍等待已经启动的 child、汇总失败并返回非零，
确保一次 run 尽可能显示全部 diagnostics，而不是在第一个失败处改变现有反馈语义。

### 3. 保持 Oxc 静态工具，不做无收益的框架替换

`oxlint` 和 `oxfmt` 已经避免了 ESLint + Prettier 的典型启动和解析成本，当前在 CI 中也不是临界
路径。本阶段只保留版本与耗时的观测：

- 不引入 type-aware ESLint、Prettier 或第二套 formatter；它们会增加重复 parse 和依赖面。
- 不按 changed files 运行 Lint/Format。它们的基线接近秒级，而 selector 会带来 Git diff、命令行
  长度、rename、ignored files 和恢复路径，净收益不成立。
- 只有当任一工具在 5 个可比 GitHub runs 的中位数达到 5 秒或以上，才重新检查 Oxc 版本、ignore
  配置、type-aware 选项和文件扫描范围；质量策略仍由相应 ADR/maintainer 决定。

### 4. 第一个 changed-file 优化只选择 site build，并且 fail closed

`build:site` 的 15 秒是独立的固定成本，且 `apps/site/package.json` 的 workspace source dependency
明确是 `@lorelum/ui`。因此首个 selector 只回答一个内部问题：这个 PR 是否可以跳过 **site build**。
它不缩减 Test 或 Typecheck。

选择器应当是无第三方依赖的 `scripts/ci` Bun script。它从 `GITHUB_EVENT_PATH` 读取 PR base SHA，
在当前 checkout 执行以下流程：

1. 非 `pull_request` 事件直接输出 `site_build=run`，因此 main push 始终完整。
2. 对 PR，尝试以 base SHA 与当前 checkout 的实际 HEAD 执行 `git diff --name-status -z`。若 shallow
   checkout 缺少 base object，只尝试一次 `git fetch --no-tags --depth=1 origin <base-sha>` 后重试；
   fetch、diff、事件解析、UTF-8 解码或 Git 状态读取任何一步失败都输出 `run`。
3. 仅当 diff 非空，且每条记录都是 `A` 或 `M`，并且每个路径都在 `packages/` 但不在
   `packages/ui/` 时输出 `skip`。`apps/site/`、`packages/ui/`、根配置/lockfile、workflow、script、
   docs、未知目录，以及 `D`、`R`、`C`、`T`、冲突或未知 status 一律输出 `run`。
4. workflow 始终启动 `verify`。它把选择原因写入 job summary；仅 site build step 依据
   `site_build=skip` 跳过，并有单独的成功步骤明确记录“因 core-package-only diff 跳过”。

限制 eligible 集合到 core package 的新增/修改是刻意保守的。即使某些 docs 或根文件实际不影响
site，第一阶段也宁可多跑 site build，也不在没有依赖图证据时扩大 skip 面。`--name-status -z` 和
对 rename/delete 的拒绝避免空格、换行或双路径 status 被简单按行分割后误判。

先以 report-only mode 部署选择器：它显示预测结果，但仍执行 site build。通过 parser fixtures、
临时 Git repository integration test、以及一组覆盖 core/UI/site/root/rename/delete/diff-failure 的
真实或合成 PR diff 后，才以独立的小 PR 把 mode 切为 enforce。fixture 或观察中任一未知状态、
意外 dependency 或 selector 异常都阻止 enforce；回滚只需恢复强制 `site_build=run`，不影响
required check 的存在。

### 5. 将 package-level affected checks 视为单独的依赖正确性项目

对 Test 或 Typecheck 直接采用 `bun test --changed` 或只看 `package.json` workspace dependency
会遗漏本仓库的实际边：`tsconfig` source `paths`、跨 package source import、test fixture、以及
`scripts/release` 的相对源码引用均不由 manifest 图完整表达。因此它们不能在本 change 的第一阶段
替代完整检查。

若 site selector 和 compiler 优化后，完整 Typecheck/Test 仍是 PR p50 的主要成本，才启动独立
proposal。它应先实现并验证一个内部、只读的 impact graph：

```text
changed source/config
  -> owning config/package
  -> TypeScript-resolved source imports + workspace dependency edges + release-script edges
  -> reverse transitive configs and colocated tests
```

根 `package.json`、`bun.lock`、所有 `tsconfig`、workflow、selector/graph scripts、生成器和无法
归属的文件必须映射为全量；解析或 graph 失败同样映射为全量。采用前需要一个带正常、反向依赖、
alias、release-script、删除和未知路径的 labelled fixture corpus，并在 shadow mode 下让候选选择
与仍然执行的完整检查并行观察。只有 corpus 表明无漏选、完整 check 的每个失败可归属到 candidate
set、且预计 GitHub p50 净节省至少 15 秒时，才讨论把 full run 换成 affected run。

### 6. cache、project references 与多 job 拓扑都有明确的重新开启条件

**Incremental/cache：** `noEmit` 并不阻止 TypeScript 的 incremental build info，但 build info 是
派生状态，必须位于已忽略的 cache 目录，key 至少覆盖 OS、compiler、lockfile 和 tsconfig。先在
真实 GitHub runner 对 cold miss、exact hit、source-change hit 各测量 restore + typecheck + save
的总时间；只有 exact hit 的 Typecheck 净改善达到 20%、cold miss 不比无 cache 慢超过 5%、且 cache
大小与 restore 稳定时才引入。不能仅因有 `.tsbuildinfo` 就宣称 CI 更快。

**Project references：** 这不是单纯的 performance flag。它会涉及 `composite`、config ownership、
declaration/build order 与当前直接 source `paths` 的迁移。只有 native compiler 后 profiling 仍显示
重复 program 构建是大头，并且一个可丢弃 spike 能在不改变 current typecheck diagnostics 的前提下
证明至少 30% 净收益，才单独设计迁移和回滚；不得与 compiler version change 混在同一 PR。

**多 job 拓扑：** 只有在前两项完成后，typical PR 的 `verify` p50 仍高于 60 秒，且预期把
Typecheck/Test/site 分开能降低 critical path 至少 20 秒时才评估。每个 job 都会重新 checkout、setup
和 install，并消耗独立 hosted runner；这些成本、组织并发配额和排队必须计入而非只看命令时间。
若采用，保留一个无条件创建的 `verify` aggregate job：它使用 `if: always()` 等待所有 child，任何
child failure/cancel/意外 skip 都使 aggregate 非零。没有 workflow 顶层 paths filter，main 的 child
jobs 都完整执行。先用可控失败场景验证失败传播和 required-check 名称，再更新 branch protection
相关说明；不能以更快的 job 图换取可被绕过的合并门槛。

## Risks / Trade-offs

| 风险 | 缓解方式 |
| --- | --- |
| Native compiler 对某个 config 或 build tool 的语义不兼容 | 逐 config 正/负向对照、完整 verify、独立 candidate lockfile；任何不解释差异即不迁移。 |
| 10 个 `tsc` 进程在 4 vCPU 上导致 oversubscription，或受限调度反而变慢 | 把 worker cap 当作 benchmark variable；只有 10% 可重复净收益才保留 scheduler。 |
| selector 错误跳过本应运行的 site build | 只允许 core package A/M、其他均 run；report-only、fixtures、Git diff/解析失败 fail closed。 |
| 为缓存、references 或 job split 增加维护面但不降低 PR 等待时间 | 每项必须达到量化净收益和正确性门槛，并在单独 change 中审查。 |
| step timing 受 hosted runner 抖动影响而得出错误结论 | 同一环境重复采样，以中位数比较，并记录 commit/lockfile/runner/命令。 |
| Required `verify` 因 paths filter 或 aggregate condition 缺失 | 保持 workflow 和 aggregate job 无条件创建；将 failure/cancel/skip 作为明确的 non-success。 |

## Migration Plan

1. **建立测量基线。** 记录当前 JS compiler 在 worker matrix 下的本地预筛和 GitHub Linux 结果；不改
   default CI 行为。将每个结果绑定到 commit、lockfile 与步骤时长。
2. **进行 TypeScript 7 spike。** 在隔离候选中显式运行所有 11 个 config，完成兼容性、完整 verify
   和三次 GitHub 测量。未达门槛则删除候选；达标时以一个只含 compiler/CI typecheck 入口的 PR
   切换，保留一个提交可回滚到当前 compiler。
3. **在独立 PR 引入 site selector 的 report-only。** 添加 parser/integration fixtures，并使 summary
   可审查但不跳过 build。收集所需 coverage 后，再以另一小 PR 启用 enforce。
4. **重新计算瓶颈。** 使用启用后的实际 PR 与 main run，判断是否达到 affected checks、cache、
   project references 或 job topology 的重新开启条件。未达到即停止，不为未来假设预建机制。
5. **每次 rollout 的回滚。** compiler 回滚恢复原 lockfile 与显式入口；selector 回滚强制 run；
   cache/references/job split 分别在各自独立 PR 中可逆。任何回滚都不改变公开产品数据或合同。

当前 PR #220 只包含已验证的 Test/Typecheck 并发改善；本设计及以上后续阶段不追加到该 PR，除非
maintainer 另行授权实施范围并完成相应验证。

## 实施证据（2026-09-22）

TypeScript 7 candidate 的实际提交为 `882bed0209de7926e871277a62dea595d2964a84`，在 PR #222 的
GitHub `ubuntu-24.04` `verify` run `35693919107` 连续完成 3 次。对比基线是 PR #220 的
`516e438140ab2928845f5661c854e757e662af98`、run `35688880784`；两者均使用 Bun 1.4.2、
同一 CI workflow 和 4 vCPU hosted runner。候选与基线的 Typecheck 入口不同，正是本次测量的
唯一预期 compiler 路径变化；候选额外有 12 条 selector/runner 测试，故 Test 总时长只用于退化
观察，不作为 compiler 收益来源。

| 样本 | Typecheck 原始 log 耗时 | Test | Build site | verify job |
| --- | ---: | ---: | ---: | ---: |
| 基线 `35688880784` | 约 21 秒 | 28.23 秒 | 约 15 秒 | 81 秒 |
| candidate attempt 1 | 3.47 秒 | 28.98 秒 | 14.68 秒 | 63 秒 |
| candidate attempt 2 | 4.86 秒 | 30.15 秒 | 19.51 秒 | 69 秒 |
| candidate attempt 3 | 3.75 秒 | 28.42 秒 | 14.18 秒 | 58 秒 |

candidate Typecheck 中位数为 3.75 秒，较约 21 秒基线减少约 82%，超过 30% adoption gate；
完整 job 中位数为 63 秒。Test 与 site build 未出现可重复退化，三次 `verify` 都成功。GitHub log
提供毫秒级 command 起止时间，足以区分这个数量级的收益，故本阶段不增加 timing wrapper。

在本地，TS 5.7、TS 6 compatibility 和 TS 7 native 对所有 11 个 CI config 均成功；两次
source-file-set 对照没有缩小仓库 source include 集，临时负向 fixture 在 TS 6 与 TS 7 下均以
非零退出。迁移所需的两个明确配置修正是 TypeScript 6/7 不再自动加载 `@types` 后添加
`types: ["bun"]`，以及移除 TypeScript 7 已删除的 UI `baseUrl`；`paths` 解析仍由覆盖对照和
site build 验证。

report-only selector 在 PR #222 正确输出 `run (site-relevant-or-unknown)`，因为该 PR 改动了根
manifest、lockfile、workflow 与 scripts。它尚未有 core-package-only 的真实 PR corpus，因此保持
report-only；不得仅据单次根配置 PR 将它改成 enforce。Typecheck 已不再是需要受限 worker scheduler
才能解决的主要成本，故本阶段保留现有 10 个 workspace fan-out，不引入未测量的 scheduler。

## Open Questions

- GitHub Actions 的实际 cache hit rate、缓存体积和组织级 runner queue 情况需要在相应候选 run 中
  测量；它们不改变本设计的 fail-closed 选择器或 compiler spike 结构。
- TypeScript 7 对本仓库现有 Vite/Cloudflare 依赖链的 API 兼容性必须由完整 candidate verify 结论
  决定，不能仅依据没有直接 `typescript` import 推断。
