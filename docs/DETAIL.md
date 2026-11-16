# Octagon Teams

Octagon Teams 是一个用于写代码的预设 agent 模式：整个团队只占一个 preset。新建会话时选择
**「Octagon Teams」**，统筹负责拆解需求、分派与验收，用 `team_spawn` 按需拉起角色
智能体——角色不是独立的 preset，不会出现在预设选择器里。

## 一个 preset，多个角色

- preset 内挂 `team-runtime`：它注册 `team_spawn` 工具与系统提示里的「团队角色」段。
- `team_spawn({ role, task })` 拉起一个角色并等待结果：角色继承同一个组合，但工具策略
  按成员独立；它收到一张「角色卡」——包含人格、职责、该角色的技能全文、任务与交付要求。
  角色卡显式声明它覆盖统筹口径，因此角色有写工具（除非配置页里停用了写工具）。
- 统筹的 `write` / `edit` / `apply_patch` 由 `team-runtime` 的 tool guard 拒绝：实现
  一定落在角色身上，统筹只读、跑命令核验、读 diff 验收。拒绝是策略，不是故障。

## 角色

| 角色 key | 智能体 | 默认职责 |
| --- | --- | --- |
| `backend` | ⚙️ 后端工程师 | 服务端代码、API、数据模型、迁移、后台任务与脚本 |
| `frontend` | 🖥️ 前端工程师 | 页面、组件、客户端状态、样式集成与构建 |
| `ui` | 🎨 界面设计师 | 视觉语言、布局、设计 token、图标与素材 |
| `ux` | 🧭 交互设计师 | 用户流程、交互规格、文案、可访问性与可用性 |
| `docs` | 📚 技术文档 | README、API 参考、使用指南、示例与发布说明 |
| `qa` | 🧪 测试工程师 | 测试方案与自动化测试；最终验收由统筹执行 |
| `reviewer` | 🔍 代码审查 | 只读审查，输出按严重度排序的问题清单 |
| `devops` | 🛠️ 运维工程师 | 构建脚本、CI、打包与本地环境搭建 |

八个角色继承同一个组合，但**工具策略是每个成员独立的**：配置页里逐个勾选，运行时的
tool guard 按 agent 拒绝未分配的工具。默认只有审查角色是只读的；其余角色可写。

### 自定义角色

配置页侧栏底部的「＋ 新建角色」可以增加成员：填名称、emoji、职责、前置提示词，并选一个
**能力档位**（dev / design / docs / qa / review，决定这套默认工具与默认停用项）。创建后它
和内置角色一样出现在 roster、`team_spawn` 的 `role` 枚举和配置页里，同样能配技能、改工具。

- 自定义角色**没有底稿**：所有字段都存在 overlay 里，删除即彻底移除（同时删掉它的技能目录）。
- 内置角色才显示「恢复该角色默认」；「全部恢复默认」只重置内置角色，不会动自定义角色。
- 角色 key 自动分配为 `custom-1`、`custom-2`……稳定不变，改名不影响 key。

## 配置页

打开 `http://127.0.0.1:50222/octagon-teams`（端口即当前 Web GUI 的 origin）。

- **统筹**：名称、emoji、职责、前置提示词（persona）——统筹的人格就是你选中的 preset。
- **每个角色**：名称、emoji、职责、前置提示词（角色卡开头）。
- **技能**：从技能市场勾选已安装技能（只读软链接进角色目录），或上传/手写 `SKILL.md`。
  角色技能全文会内联进角色卡，所以只有该角色看得到、用得上。
- **内置工具**：点击工具即可停用/启用，**只影响当前成员**，保存后立即生效；「恢复默认工具」
  回到该成员出厂设置。团队之间不共享工具策略。

改动写入 `<profile>/octagon-teams/overlay.json`，随包底稿 `baseline.js` 不被改写；
**恢复该角色默认** / **全部恢复默认** 随时回到原始配置，且不删除技能文件。保存后只会
重新注册那一个团队 preset：新会话立即生效，已存在的会话保留创建时的 revision。

## 工具与协调规则

- **只有 Lead 能派生或协调其他智能体**：`team_spawn` / `send_message` / `wait_agent` /
  `list_agents` / `interrupt_agent` 对角色一律拒绝；角色需要别的角色协作时，把「要谁、
  做什么、为什么」报告给 Lead，由 Lead 分派。
- **每个成员有自己的工具集**：按角色给不同的默认档位，看不到的工具直接隐藏
  （`team_spawn` / `send_message` / `wait_agent` / `list_agents` / `interrupt_agent` /
  `ask_user_question` 等协调类工具不出现在角色页）。角标显示 `已启用 / 该成员可见工具数`。默认停用规则写在 `policy.js` 的
  `DEFAULT_DISABLED` 与 `TIER_PRESETS`：统筹永远不能写文件；实现类角色默认关掉 `present`
  与任务板写操作；设计类再关 `apply_patch`；文档再关 `read_image`；审查角色只读。
  「恢复默认工具」把该成员切回默认档位；停用的调用会被运行时拒绝。
- **提问先经过 Lead**：`ask_user_question` 只开放给 Lead。角色缺信息或需要用户拍板时，
  把问题、候选选项与倾向答案写进返回结果；Lead 能自行回答的就继续，确实需要用户回答时
  再由 Lead 统一向用户提问。
- **策略即边界**：工具可见性仍是团队共享的（单个 preset 只有一个组合），调用超出该成员
  工具集时由 guard 拒绝并说明原因；这是刻意的取舍，避免为每个角色注册一个会出现在选择器
  里的 preset。

## 能力申请（M4）

角色缺少某个工具或技能时，不再只靠把缺口写进结果：它调用
`request_capability({ kind: 'tool' | 'skill', name, reason[, content] })` 登记申请，
然后继续用现有工具推进，不等结果。

- **Lead 审批**：`capability_requests` 查看待处理；`capability_decide({ id, decision, note })`
  批准或拒绝。`team_spawn` 的返回里也会带上该角色未处理的申请（`pending`），不会漏看。
- **配置页审批**：普通成员页签旁的「能力申请」列出所有待处理申请，可以代替 Lead 批准/拒绝；
  处理记录写入 `<profile>/octagon-teams/requests.json`（保留最近 200 条）。
- **批准工具**：写入 overlay 的 `grants` 并立即推进运行时策略——该角色当前会话就能调用，
  重启后仍然有效；「恢复默认工具」会清掉该角色的授权。
- **批准技能**：申请里附带的 `SKILL.md` 正文写入该角色自己的技能目录，下一次被
  `team_spawn` 拉起时进入角色卡；当前正在跑的实例看不到。
- 申请只记录、不阻塞；拒绝会带 `note` 说明原因，角色应换方案或把缺口写进结果。

## 验收自检

`POST /octagon-teams/api/selftest`（JSON：`{ "task": "…", "cwd": "/abs/path" }`）会新建一个
空白会话、挂上本 preset、投递一条用户消息，跑完后返回：工具调用序列、派生出的子智能体、
最终回答与耗时。它走的是 `ctx.agents.create()` + `ctx.agentPresets.select()`，和用户新建
会话是同一条路径，因此能验证 preset 组合、工具守卫、`team_spawn` 与角色卡。

- 默认开启（插件行 `config.selftest`），只是本地 HTTP 路由；不想用就设成 `false` 重新安装。
- 每次自检会在 `~/.dsh/sessions` 留一个 `session-octagon-selftest-*` 会话；不需要时手动清理。
- 最近一次完整验收（含证据与清理记录）见 [M5-ACCEPTANCE.md](M5-ACCEPTANCE.md)。

## 团队模式

统筹会话自动开启 Team 模式：出现 `team_task_*` 工具与 **Shared tasks** 面板，统筹可以
用任务板记录分派，也可直接 `team_spawn`。任务板与 `team_spawn` 可以并用：前者管状态，
后者真正执行。

## 工具清单

配置页「内置工具」标签页按能力分组列出团队实际挂载的 24 个工具，可逐项停用/启用并保存；
`仅 Lead` 标记协调类工具，统筹的写工具标 `永久关闭`。清单来自 `tools.js` 与 preset
构建代码共用的表。

页面支持深链：`/octagon-teams?role=qa&tab=tools`（`role` 取 `lead` 或角色 key，
`tab` 取 `profile` / `skills` / `tools`）。

## 当前限制

- 角色 id 与团队 preset id 均为 `octagon-<uuidv7>`，每个 profile 稳定不变。
- Host 级工具（MCP 服务器、插件管理、上下文压缩等）不随 preset 变化，可能同样出现在
  角色会话里，最终以角色会话中的实际工具列表为准。

## 在 DSH 设置里打开配置页

安装后，「设置 → Agent 预设 → 自定义」里的「Octagon Teams」卡片底部会多出一个「打开配置」按钮，点击后用浏览器新标签打开 `http://<当前主机>:<端口>/octagon-teams`（端口跟随当前 Web GUI）。

实现说明：DSH 的预设卡片由自带客户端渲染，没有卡片级扩展插槽，因此这个按钮由客户端插件在 `li[data-agent-preset-id^="octagon-"]` 的卡片底部注入，并通过 MutationObserver 在 React 重渲染后补回；插件卸载时移除。上游若增加卡片动作插槽，可改为正式注册。
