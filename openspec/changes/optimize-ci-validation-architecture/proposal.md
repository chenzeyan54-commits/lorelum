## Why

当前 GitHub CI 在单个 `verify` job 中顺序执行 typecheck、test 和 site build。最近已验证的
run 表明，Test 优化后 Typecheck 仍需 21 秒、site build 需 15 秒；而 lint、format 和依赖安装
都不是主要瓶颈。当前根 typecheck 还使用 TypeScript 5.7.2 的 JavaScript 编译器，并让多个
workspace project 重复建立相互重叠的 TypeScript program。

本 change 只记录内部验证系统的优化路线，不改变 Lorelum 的 CLI、Pack、retrieval、Backend 或
公开产品合同。目标是以完整覆盖、可回退和 required check 不缺失为前提，降低 PR 的验证等待
时间和不必要的 runner work。

## What Changes

- 建立 TypeScript 7 原生编译器的兼容性与性能 spike：必须与当前完整 typecheck 的成功/失败
  语义和配置覆盖逐项对照，达到门槛才升级默认 compiler。
- 将 site build 的执行选择限制为保守、可解释的变更范围；未知输入、根配置、lockfile、workflow
  或选择器故障一律运行完整 site 验证。
- 为 CI 增加阶段级 timing evidence，区分 compiler、test、site build、安装和静态工具时间；将
  提升 package-level affected checks、TypeScript incremental cache、project references 或多 job
  拓扑的条件写成明确的后续证据门槛。
- 保持 `verify` 作为每个 PR 与 main push 都存在的 required check；main 分支继续执行全量验证。
- **BREAKING**: 无公开产品、CLI 或格式合同变化。

## Capabilities

### New Capabilities

无。该 change 是内部 CI/toolchain 优化，不引入产品行为或新的公开 capability contract。

### Modified Capabilities

无。现有 OpenSpec capability 的 REQUIREMENTS 不变。

## Impact

- 可能影响根 `package.json`/lockfile、`.github/workflows/ci.yml`、新增的内部 CI 选择或测量脚本，
  以及 CI 维护文档。
- TypeScript compiler 升级可能影响所有 workspace typecheck diagnostics，必须在实现前后通过完整
  workspace 与 release-script 检查验证。
- GitHub branch rules 当前要求严格的 `verify` status；任何 paths 或 job 拆分都必须保留该 check
  并在不确定时 fail closed 执行全量验证。
