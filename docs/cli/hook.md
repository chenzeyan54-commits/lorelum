# Codex Hook

`lore hook codex` 是 Lorelum CLI 与 Codex Plugin 之间的版本化集成 ABI。它从 stdin 读取 Codex Hook payload，并在 stdout 输出一行 Codex Hook envelope；它不输出普通 Lorelum CLI JSON envelope。

```sh
printf '%s\n' '{"hook_event_name":"SessionStart"}' | lore hook codex
```

成功时，stdout 是包含 `hookSpecificOutput.hookEventName` 和受限 `additionalContext` 的对象。Catalog 包含已安装 Pack 的名称、版本、可选 description 和 `appliesTo`；它只是检索路由提示，不是完整 Practice 内容。

`lore hook codex` 只支持 `SessionStart`。生命周期来源（例如 `compact`）由 Codex Plugin 的 `hooks.json` matcher 决定，CLI 不推断启动、恢复、清理或 compact 时机。它不会主动 query/get Practice、启动 Backend、下载模型、构建 index 或修改 Store。

Hook payload 无效、事件不支持或 Store 读取失败时，命令会向 stderr 写诊断，并在 stdout 输出：

```json
{"continue":true}
```

这样 Codex 可以继续运行，不把 Lorelum 的本地问题当作会话阻塞。该 Hook 执行路径以退出码 `0` 返回；无效的 CLI 参数仍按普通 CLI 用法错误处理。

需要隔离 Store 时，使用全局选项：

```sh
printf '%s\n' '{"hook_event_name":"SessionStart"}' \
  | lore hook codex --store-root /absolute/path/to/isolated-store
```
