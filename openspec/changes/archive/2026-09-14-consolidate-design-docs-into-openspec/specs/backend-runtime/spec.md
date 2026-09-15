## Purpose

定义本机 Backend 的控制面、身份认证、生命周期和数据边界，使 semantic runtime 可复用而不会把 loopback 服务误暴露为远程接口或 Store 事实来源。

## ADDED Requirements

### Requirement: Private loopback lifecycle
Backend SHALL 仅监听固定 loopback authority `127.0.0.1:26186`。`lore backend start` MUST 安全复用兼容实例或启动新实例，`lore backend status` MUST 保持只读，`lore backend stop` MUST 仅在 daemon 实际进入停止流程后报告成功；这些命令 MUST 不使用 `--store-root` 选择模型、配置或服务地址。

#### Scenario: Repeated lifecycle control
- **WHEN** 调用方对已运行或已停止的 Backend 重复执行 start、status 或 stop
- **THEN** 命令 MUST 返回与实际 lifecycle 状态一致的 JSON 结果，且 MUST 不按端口号或进程名终止未经认证的进程

### Requirement: Authenticated local control boundary
Backend client MUST 先验证 nonce-bound instance identity、build identity 和内部协议兼容性，随后才向受保护接口发送 runtime credential。Backend MUST 拒绝不符合 loopback authority、Host、Origin、body-size 与认证边界的请求，且 MUST 不向响应泄露 runtime secret、本机私有路径、native 私有端口或原始 Practice/query 输入。

#### Scenario: Untrusted local HTTP request
- **WHEN** HTTP 请求缺少有效认证、携带 Origin、使用错误 authority 或超过 body 限制
- **THEN** Backend MUST 拒绝该请求，且响应 MUST 不泄露 daemon runtime detail

### Requirement: Engine and Store responsibility boundary
Backend SHALL 承载模型、认证、进程和 operation 生命周期，但 MUST 通过 Engine use case 执行 Practice 读取、检索、index 与排名规则。keyword retrieval MUST 保持 `CLI → Engine` 的离线路径；semantic 运行 MUST 保持 `CLI → Backend client → Backend daemon → Engine`，且不得引入 `CLI → Engine → Backend client` 路径。

#### Scenario: Semantic request selects a Store
- **WHEN** semantic request 携带 selected Store root
- **THEN** Backend MUST 将该 root 作为 Engine 的 Store/index 输入，而不得把它解释为模型、runtime 或 Backend 配置选择器
