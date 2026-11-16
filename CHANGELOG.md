# Changelog

## v0.0.2 — 2026-11-16

- 包名改为 `@hexa-center/octagon-teams`（原 `@local/octagon-teams`），可直接从 GitHub 安装。
- 插件行、角色运行时行、客户端模块 id 与文档同步更新；预设 id 与 profile 状态保持不变，
  升级不会丢失角色配置与已批准的能力申请。
- 仓库公开：https://github.com/hexa-center/dsh-octagon-teams

## v0.0.1 — 2026-11-16

首个可用版本：把「一个团队」做成单个 DSH agent 预设。

- **一个预设**：`Octagon Teams` 在新会话选择器里只占一项；角色不再是预设。
- **按需派活**：`team_spawn(role, task)` 拉起角色智能体，角色卡内联职责、人格、技能与工具边界。
- **只读 Lead**：运行时的 tool guard 拒绝统筹的 `write` / `edit` / `apply_patch`；工具策略按成员独立，配置页可逐项启停。
- **只有 Lead 能协调**：`team_spawn` / `send_message` / `wait_agent` / `list_agents` / `interrupt_agent` / `ask_user_question` 对角色一律拒绝；角色的问题先回到 Lead。
- **配置中心** `/octagon-teams`：改名称/emoji/职责/人格、从技能市场勾选或上传技能、按成员调整工具、底稿 overlay 与恢复默认。
- **自定义角色**：新建/删除，选能力档位（dev / design / docs / qa / review）继承默认工具集。
- **能力申请**：角色用 `request_capability` 申请缺失的工具或技能，Lead 用 `capability_decide` 批准/拒绝；工具批准立即生效并持久化。
- **验收自检**：`POST /octagon-teams/api/selftest` 走真实会话路径跑一轮，返回工具序列、子智能体与最终回答。
- **Web 客户端半**：DSH 设置页「Agent 预设 → Octagon Teams」卡片底部有「打开配置」按钮，用系统浏览器打开配置中心。
