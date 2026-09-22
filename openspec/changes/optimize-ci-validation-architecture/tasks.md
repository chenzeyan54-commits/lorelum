## 1. 建立可比较的 GitHub CI 基线

- [ ] 1.1 记录当前 `516e438` 等可比基线的 commit、lockfile、runner、每个 CI step 的 exit status 与 duration；在本地预筛并在 `ubuntu-24.04` 对 current JavaScript compiler 测量 `1/2/3/4/10` 个 typecheck worker，验证结果不把排队时间或无关步骤归因给 Typecheck。
- [x] 1.2 若 GitHub Actions 的 step 时间分辨率不足以判定候选，新增最小的内部 timing wrapper，验证它以参数数组执行 child、输出到 `GITHUB_STEP_SUMMARY`，并完整保留 child 的非零 exit code 和 signal；否则记录使用 Actions 原生 step timing 的决定且不添加 wrapper。

## 2. 验证并有条件迁移 TypeScript 7 原生 compiler

- [x] 2.1 在隔离候选 worktree 配置官方支持的 TypeScript 7 native `tsc` 与必要的 JavaScript TypeScript API 兼容依赖，盘点直接及 Vite/site build、design lint、release script 的间接 API 使用；验证不删除仍被工具实际解析的 JavaScript TypeScript package。
- [x] 2.2 实现显式 typecheck 入口，使 CI 的 9 个 package config、site config 和 release-script config 全部由同一候选 compiler 调用；同时使每个 workspace 的直接 `typecheck` 命令也不依赖 workspace-local `PATH` 选择另一套 compiler。验证 command 列表恰为 11 个 config，`--showConfig`/file-list 对照没有缩小 source include 集，且 `bun run --filter @lorelum/site typecheck -- --version` 输出 native compiler 版本。
- [x] 2.3 为 current 与 candidate compiler 运行逐 config 正向比较及不提交的最小负向 fixture；验证每个 config exit status 一致、负向 fixture 在两者下均为非零，并保存任何 diagnostics 差异以供明确裁决。
- [x] 2.4 在 candidate lockfile 下运行完整 `verify`，并在同一 GitHub Linux runner 采样至少 3 次；只有 Typecheck 中位数至少改善 30%、其余阶段没有超过 5% 的可重复退化时，才以独立 PR 切换默认 compiler。否则移除候选改动并记录未迁移的证据。
- [ ] 2.5 仅当 worker matrix 显示相对当前无上限调度至少 10% 的可重复收益且无 memory/flake 退化时，实现受限 workspace scheduler；验证它等待已启动 child、汇总所有失败 diagnostics 并以非零退出。未达到门槛则保留现有调度且不添加 scheduler。

## 3. 以 fail-closed 方式选择 site build

- [x] 3.1 新增无第三方依赖的 site-build selector，读取 PR event/base SHA 并以 `git diff --name-status -z` 分类；验证仅全部为非 `packages/ui` 的 `packages/**` 新增/修改时给出 `skip`，而 UI/site/root/docs/workflow/script/lockfile、delete/rename/未知 status、空 diff 与所有解析/fetch/diff 失败均给出 `run`。
- [x] 3.2 为 selector 编写 parser fixtures 和临时 Git repository integration test，覆盖 base 缺失后的单次浅 fetch、双路径 rename、删除、UTF-8/事件错误和 unknown path；验证任一异常均不会产生 `skip`。
- [x] 3.3 在 `verify` 内以 report-only mode 接入 selector 和 job summary，保持所有 PR/main push 的 site build 实际执行；验证 workflow 没有顶层 `paths` filter、`verify` 总会创建，且 main push 始终报告 `site_build=run`。
- [ ] 3.4 完成 core/UI/site/root/rename/delete/diff-failure 的 selector evidence corpus 后，以独立小 PR 切换到 enforce mode；验证 eligible core-package-only PR 明确记录跳过原因，其他 PR 仍执行 site build，并能通过强制 `site_build=run` 一提交回滚。

## 4. 重新评估高复杂度候选，而不是预先实现

- [ ] 4.1 使用启用 compiler/site 优化后的可比 GitHub runs 重新计算 PR 与 main 的 p50、阶段占比和 runner 准备成本；验证每一项结果绑定到具体 commit、lockfile、runner 与命令，并据此决定是否停止在当前阶段。
- [ ] 4.2 只有完整 Typecheck/Test 仍为主要瓶颈且预计节省至少 15 秒时，另行提出 affected-checks change；其 proposal 必须包含 TypeScript-resolved imports、workspace/release-script edge、全量 fallback 和 shadow-mode labelled corpus，验证不能把 `bun test --changed` 或 manifest graph 单独当作正确性证明。
- [ ] 4.3 只有 exact cache hit 的总 Typecheck 至少净改善 20%、cold miss 慢不超过 5% 时，另行提出 incremental/cache change；验证 `.tsbuildinfo` 位于 ignored derived-state 目录，key 覆盖 OS/compiler/lockfile/tsconfig，并测量 restore、typecheck、save 的合计时间。
- [ ] 4.4 只有 native compiler 后 profiling 仍显示重复 program 构建为主要成本且 discardable spike 证明至少 30% 净收益时，另行提出 project-references migration；验证它单独处理 `composite`、build order、source `paths` 和回滚，不与 compiler upgrade 混合。
- [ ] 4.5 只有 typical `verify` p50 仍超过 60 秒且拆分 child jobs 预计降低 critical path 至少 20 秒时，另行提出 CI topology change；验证无条件 `verify` aggregate 使用 `if: always()` 并把任一 child failure/cancel/skip 传为 non-success，且不使用 workflow 顶层 paths filter。

## 5. 验证、审查与交付边界

- [x] 5.1 对每个实际实施 PR 运行与改动边界匹配的 focused tests、完整 `verify`、`git diff --check` 和 OpenSpec strict validation；验证性能结果只引用覆盖当前 commit/configuration 的 run，不复用已被改动失效的旧结果。
- [ ] 5.2 在任何未来 commit/push 前审查 staged 文件与完整 diff、执行仓库适用的 secret-pattern scan，并验证本 change 未包含 cache、log、timing 输出或本机机器状态；报告每个独立 PR 的实际收益、回滚方式和未达到门槛而被保留为 deferred 的候选。
