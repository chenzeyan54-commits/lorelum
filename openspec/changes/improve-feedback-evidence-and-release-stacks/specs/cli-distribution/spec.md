## ADDED Requirements

### Requirement: Compiled CLI preserves source-mapped diagnostic locations
`build:cli`、release staging 和 release archive 所使用的编译路径 SHALL 显式关闭 minify，并在单文件 `lore` executable 中嵌入可由运行时使用的 source map。来自 Lorelum TypeScript 源码的未处理异常和已记录 Error stack MUST 能还原到原始 `packages/**/**.ts:<line>:<column>` 位置，而不得只暴露编译 bundle、`$bunfs` 或压缩后位置。

编译产物验证 MUST 实际执行与待交付构建路径等价的 binary，并以一个可控异常断言 source location 还原；源级单元测试或未编译的 CLI 运行不得替代该验证。将来任何启用 minify 的提议 MUST 保持这一验证通过，否则不得进入发行路径。

#### Scenario: A compiled release executable reports an original TypeScript location
- **WHEN** 编译验证执行一个会抛出已知异常的 Lorelum TypeScript fixture
- **THEN** 该 executable 的异常输出或已记录 stack MUST 指向 fixture 的原始 `.ts` 文件及其行列号，并不得把 release bundle 或 `$bunfs` 作为唯一可定位位置
