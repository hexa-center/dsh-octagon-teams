# M5 端到端验收记录（2026-11-16）

真实验收不经过配置页的模拟：`selftest.js` 通过 Host 的 `ctx.agents.create()` 建一个空白会话，
用 `ctx.agentPresets.select()` 挂载团队 preset，再投递一条用户消息，等它跑完后收集
`tool/call` 事件、子智能体与最终回答。

复现命令（端口取当前 Web GUI）：

```bash
curl -s -X POST http://127.0.0.1:<port>/octagon-teams/api/selftest \
  -H 'content-type: application/json' \
  -d '{"task":"…","cwd":"/path/to/workspace"}'
```

## 用例 1：Lead 派活 → 角色实现 → Lead 验收

任务：在 `demo/` 实现 `slugify`（含 3 个 `node:test` 用例）并运行测试。（该演示目录已在发布前删除，产物见下。）

| 证据 | 结果 |
|---|---|
| Lead 工具调用 | `bash`（勘察）→ `todo_write` → `team_spawn(role=backend)` → `bash`（`node --test`）→ `read` ×2 |
| 交付物 | `demo/index.js`（`slugify(text)`）、`demo/index.test.mjs`（3 个用例），文件时间戳 = 运行时刻 |
| 测试 | `node --test demo/index.test.mjs` → `# tests 3 / pass 3 / fail 0` |
| 耗时 | 144.9 s |

Lead 还额外发现了 `node --test demo`（目录参数）在 Node v22.14.0 上"假通过"的坑：
它把 `demo` 当模块加载，只跑 1 个空测试并返回 0。这个结论来自它自己做的对照实验，
不是复述任务描述。

## 用例 2：权限边界与角色身份

任务：让 Lead 先直接 `write`，再 `team_spawn(backend)` 让它回答角色名并实际写文件。

| 检查 | 实测 |
|---|---|
| Lead 调 `write` | 被拒绝：`统筹不直接改文件：用 team_spawn 把实现交给角色智能体（write/edit/apply_patch 由策略拦截）。` |
| `demo/lead-probe.txt` | 未创建（Lead 自己 `ls` 复核） |
| backend 角色名 | `backend`（⚙️ 后端工程师） |
| backend 工具集 | 有 `write` / `edit` / `apply_patch`；停用 `present`、`team_task_create`、`team_task_update` |
| backend 写文件 | 成功写入 `demo/role-probe.txt`（253 B），Lead 用 `ls`/`cat` 独立复核 |
| 耗时 | 18.9 s |

## 清理

- 自检产生的 7 个 `session-octagon-selftest-*` 会话日志已删除，不会出现在用户的会话列表。
- 探针文件 `demo/role-probe.txt` 已删除；验收用完的 `demo/` 也在发布 v0.0.1 前删除。
- 临时 profile `m5`（headless 试验用）已删除。
