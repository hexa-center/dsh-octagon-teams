/**
 * Read-only view of the tools a preset actually mounts.
 *
 * This module only *describes* the rows that build a preset: it never registers
 * or removes a tool. The mapping is kept next to the preset builder so the
 * configuration page and the preset cannot drift apart.
 */

/** Row ids that appear in a preset but are not model-facing tools. */
const NON_TOOL_ROWS = new Set([
  'persona', 'agent-instructions', 'time-context', 'skill-filesystem', 'compaction', 'command-compact',
])

/** Human labels for the composition rows. */
export const ROW_LABELS = {
  'tool-fs': '文件读写',
  'tool-fs-search': '文件搜索',
  'tool-bash': '命令执行',
  'tool-jobs': '后台任务',
  'tool-web': '网络',
  'tool-ask-user': '向你提问',
  present: '交付物',
  'tool-agent-team': '团队任务板',
  'tool-subagent-control': '子智能体通信',
  'tool-subagent': '子智能体派生',
  'tool-todo': '待办',
  'tool-skill': '技能加载',
  'team-runtime': '团队运行时',
  compaction: '上下文命令',
}

/** One entry per tool: model-facing name plus a one-line explanation. */
const TOOLS = {
  read: { summary: '读取文本文件，带行号，可按区间分段读' },
  read_image: { summary: '查看图片（截图、设计稿、图表）' },
  write: { summary: '新建文件或整体覆盖已有文件' },
  edit: { summary: '按原文定位做最小替换' },
  apply_patch: { summary: '按补丁文本批量修改多个位置' },
  glob: { summary: '按路径模式查找文件' },
  grep: { summary: '按正则搜索文件内容' },
  bash: { summary: '执行 shell 命令；工作区外受沙箱策略限制' },
  job_list: { summary: '列出后台任务' },
  job_output: { summary: '读取后台任务输出' },
  job_kill: { summary: '停止后台任务' },
  web_search: { summary: '联网搜索并返回来源列表' },
  web_fetch: { summary: '抓取指定网址的正文' },
  ask_user_question: { summary: '向用户提出选择题或确认' },
  present: { summary: '把文件登记为可交付产物' },
  team_task_create: { summary: '在共享任务板新建任务' },
  team_task_list: { summary: '查看任务板的就绪状态与归属' },
  team_task_get: { summary: '读取单个任务的最新内容' },
  team_task_update: { summary: '认领/完成/改派/编辑任务' },
  send_message: { summary: '给子智能体发消息或继续它' },
  wait_agent: { summary: '等待子智能体或用户的下一条输入' },
  list_agents: { summary: '查看子智能体树与状态' },
  interrupt_agent: { summary: '中断子智能体当前回合' },
  subagent: { summary: '派生一个带角色预设的子智能体' },
  todo_write: { summary: '维护任务清单与进度' },
  team_spawn: { summary: '按需拉起一个团队角色，把任务交给它并等待结果' },
  request_capability: { summary: '向 Lead 申请未分配的工具或技能' },
  capability_requests: { summary: '查看角色提出的能力申请' },
  capability_decide: { summary: '批准或拒绝一条能力申请' },
  skill: { summary: '按名字加载一个技能的完整指令' },
  compact: { summary: '手动压缩上下文（/compact 命令）' },
}

/**
 * Tools contributed by one row, honoring the row's config.
 * @param {string} rowId - plugin row id from the preset.
 * @param {Record<string, any>} config - that row's config.
 * @returns {string[]} tool names.
 */
function toolsOfRow(rowId, config = {}) {
  switch (rowId) {
    case 'tool-fs': {
      const names = []
      if (config.read !== false) names.push('read')
      if (config.readImage !== false) names.push('read_image')
      if (config.write !== false) names.push('write')
      if (config.edit !== false) names.push('edit')
      if (config.applyPatch === true) names.push('apply_patch')
      return names
    }
    case 'tool-fs-search':
      return ['glob', 'grep']
    case 'tool-bash':
      return ['bash']
    case 'tool-jobs':
      return ['job_list', 'job_output', 'job_kill']
    case 'tool-web':
      return ['web_search', ...(config.fetch === false ? [] : ['web_fetch'])]
    case 'tool-ask-user':
      return ['ask_user_question']
    case 'present':
      return ['present']
    case 'tool-agent-team':
      return ['team_task_create', 'team_task_list', 'team_task_get', 'team_task_update']
    case 'tool-subagent-control':
      return ['send_message', 'wait_agent', 'list_agents', ...(config.interrupt === false ? [] : ['interrupt_agent'])]
    case 'tool-subagent':
      return [typeof config.toolName === 'string' && config.toolName.trim() !== '' ? config.toolName : 'subagent']
    case 'tool-todo':
      return ['todo_write']
    case 'team-runtime':
      return ['team_spawn', 'capability_requests', 'capability_decide', 'request_capability']
    case 'tool-skill':
      return ['skill']
    case 'compaction':
      return ['compact']
    default:
      return []
  }
}

/** @param {Array<any>} plugins - preset plugin rows, possibly containing group rows. */
function flatten(plugins, out = []) {
  for (const row of plugins ?? []) {
    if (row?.name === 'cordis:group' && Array.isArray(row.config)) flatten(row.config, out)
    else out.push(row)
  }
  return out
}

/**
 * Describe the tools a preset definition mounts.
 * @param {{plugins: Array<any>}} definition - one PresetDefinition.
 * @returns {{count: number, groups: Array<{id: string, label: string, tools: Array<{name: string, summary: string}>}>}}
 */
export function describeTools(definition, hidden = []) {
  const groups = []
  const seen = new Set()
  const skip = new Set(hidden)
  for (const row of flatten(definition.plugins)) {
    if (!row?.id || NON_TOOL_ROWS.has(row.id)) continue
    const names = toolsOfRow(row.id, row.config ?? {}).filter((name) => !seen.has(name) && !skip.has(name))
    if (names.length === 0) continue
    names.forEach((name) => seen.add(name))
    groups.push({
      id: row.id,
      label: ROW_LABELS[row.id] ?? row.id,
      tools: names.map((name) => ({ name, summary: TOOLS[name]?.summary ?? '' })),
    })
  }
  return { count: seen.size, groups }
}

/** Tools worth calling out when a role does not have them. */
const NOTABLE = [
  'read', 'write', 'edit', 'apply_patch', 'read_image', 'bash', 'job_list', 'web_search', 'web_fetch',
  'ask_user_question', 'present', 'team_task_create', 'subagent', 'todo_write', 'skill',
]

/**
 * Compute the notable gaps for a preset.
 * @param {{plugins: Array<any>}} definition - one PresetDefinition.
 * @returns {string[]} notable tool names this preset does not mount.
 */
export function missingTools(definition) {
  const present = new Set(describeTools(definition).groups.flatMap((group) => group.tools.map((tool) => tool.name)))
  return NOTABLE.filter((name) => !present.has(name))
}
