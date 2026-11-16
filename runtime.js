/**
 * Team-facing composition of the Octagon Teams preset.
 *
 * Mounted inside the preset (not the Host), so everything registered here is
 * scoped to the team's agents:
 *
 * - a tool guard that keeps the coordinator read-only, keeps agent steering on
 *   the coordinator only, and enforces each agent's own disabled-tool set,
 * - a `team_spawn` tool that starts one role on demand with its role card, and
 * - a `octagon:roster` prompt section listing the roles that exist right now.
 *
 * Roles are deliberately *not* separate presets: the preset picker exposes every
 * registered preset, so one team preset with on-demand roles is the shape that
 * matches "one team" rather than "nine selectable agents".
 *
 * Plain object tool definitions only: this profile has no `@deepseek-ai/*`
 * packages in its `node_modules`, so the plugin cannot import `defineTool`.
 */
import { effectiveRoles, listSkills, readSkill } from './state.js'
import { applyApproval } from './capability.js'
import { isWorker, markWorker, workerRole } from './worker-state.js'
import { LEAD_BLOCKED_TOOLS, LEAD_KEY, LEAD_ONLY_TOOLS, ROLE_ONLY_TOOLS, disabledFor } from './policy.js'
import { decideRequest, listRequests, pendingFor, recordRequest } from './requests.js'

export const name = 'team-runtime'
export const inject = ['tools', 'systemPrompt', 'subagents']

/** Cap the inline skill text one role card carries. */
const SKILL_BUDGET = 24_000

/**
 * Role card handed to a spawned agent. The spawned agent inherits the team
 * preset and its persona, so the card states explicitly that it supersedes the
 * coordinator wording.
 * @param {{key:string,name:string,emoji:string,requirement:string,persona:string}} role - effective role.
 * @param {string} task - the task text from the lead.
 * @returns {string} prompt text.
 */
export function roleCard(role, task) {
  const disabled = disabledFor(role.key)
  const writeTools = ['write', 'edit', 'apply_patch'].filter((tool) => !disabled.includes(tool))
  const toolsLine = disabled.length === 0
    ? '你的工具集与团队其他成员独立，全部开放。'
    : `你的工具集中已停用：${disabled.join('、')}；调用它们会被运行时拒绝，需要时向 Lead 报告缺口。`
  const parts = [
    `【角色卡】你现在是「${role.emoji} ${role.name}」，是本团队的实现角色，不是统筹。系统提示里“统筹不写文件”的约束只适用于 Lead。${writeTools.length > 0 ? `你拥有 ${writeTools.join('/')}，应当直接动手。` : '你的写工具已被停用，只能做只读工作。'}`,
    `职责：${role.requirement}`,
    toolsLine,
    role.persona,
  ]
  let budget = SKILL_BUDGET
  const skills = []
  for (const skill of listSkills(role.key)) {
    if (budget <= 0) break
    try {
      const text = readSkill(role.key, skill.name)
      if (text.length > budget) break
      budget -= text.length
      skills.push(text.trim())
    } catch {
      // A skill directory without a readable SKILL.md is skipped, not fatal.
    }
  }
  parts.push(skills.length > 0
    ? `## 你的技能\n\n本角色被配置了 ${skills.length} 个技能，指令如下：\n\n${skills.join('\n\n---\n\n')}`
    : '## 你的技能\n\n本角色没有额外技能；按职责和仓库既有约定执行。')
  parts.push(`## 任务\n\n${task}`)
  parts.push('## 交付要求\n\n动手前先读相关代码与约定；完成后汇报：改了哪些文件、跑了什么验证及结果、未验证项与风险。缺信息、缺能力或需要用户决策时，把问题、候选选项和你倾向的答案写进结果交给 Lead——不要调用 ask_user_question 直接问用户，也不要空转反问；由 Lead 决定能否自行回答，必要时再由 Lead 向用户提问。\n\n如果缺少某个工具或技能才能完成，调用 `request_capability({ kind, name, reason[, content] })` 提出申请：工具批准后当前会话立即生效；技能批准后对你下一次被拉起生效。申请后不要空等——先用现有工具推进，把缺口写进结果。')
  return parts.join('\n\n')
}

/**
 * Prompt section listing the roles that currently exist.
 * @param {Array<{key:string,name:string,emoji:string,requirement:string}>} roles - effective roles.
 * @returns {string} section text.
 */
export function rosterText(roles) {
  const lines = roles.map((role) => `- \`${role.key}\` ${role.emoji} ${role.name}：${role.requirement}`)
  return [
    '## 团队角色',
    '',
    '你是这个团队的统筹。实现工作不属于你：用 `team_spawn({ role, task })` 拉起一个角色，把完整任务（背景、交付物、验收标准、约束）交给它，等它返回后再自己验收。',
    '',
    ...lines,
    '',
    '规则：一次 team_spawn 只做一件事，任务描述要能让对方独立开工；角色返回后你负责核对结果，必要时带着具体修改意见再次 team_spawn 或追问。你的 write/edit/apply_patch 会被策略拒绝——这是设计，不是故障。',
    '',
    '协作规则：只有你能派生或协调其他智能体；角色不能自己调用 team_spawn / send_message 等协调工具，需要其他角色时必须先向你报告。每个角色有自己的工具集，配置页里逐个勾选；被停用的工具调用会被策略拒绝。',
    '',
    '能力申请：角色缺少工具或技能时会调用 request_capability。用 `capability_requests` 查看待处理申请，用 `capability_decide({ id, decision: "approve" | "deny", note })` 决定：批准工具后该角色立刻可用；技能批准后写入它的技能目录，下一次派生生效。批准要给理由，属于权限扩大或花钱的操作先问用户。',
    '',
    '提问规则：角色不能直接向用户提问（ask_user_question 只开放给你）。角色返回的问题先由你判断：能用代码、文档、任务上下文回答的就自己回答并继续派活；确实需要用户拍板（方向取舍、权限、验收口径）时，再由你用 ask_user_question 汇总提问。',
  ].join('\n')
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - preset-scoped context.
 * @param {{profileDir?: string}} [config] - row config.
 */
export function apply(ctx, config = {}) {
  const roles = effectiveRoles()
  const roleKeys = roles.map((role) => role.key)
  const known = new Set(roleKeys)

  ctx.effect(() => ctx.tools.guard((exec) => {
    const agentId = exec.agent?.id
    const key = agentId && isWorker(agentId) ? workerRole(agentId) : LEAD_KEY
    if (key !== LEAD_KEY && exec.name === 'ask_user_question') {
      return { reason: '不要直接向用户提问：把问题、候选选项和你倾向的答案写进返回结果，由 Lead 判断能否自行回答，必要时再由 Lead 向用户提问。' }
    }
    if (key === LEAD_KEY && ROLE_ONLY_TOOLS.includes(exec.name)) {
      return { reason: '「request_capability」由角色提出：角色的能力缺口会在它的返回结果里说明，由你决定是否批准。' }
    }
    if (key !== LEAD_KEY && LEAD_ONLY_TOOLS.includes(exec.name)) {
      return { reason: `只有 Lead 能调用「${exec.name}」派生或协调其他智能体。需要别的角色协作时，把所需角色、要它做什么、理由写清楚汇报给 Lead，由 Lead 决定并分派。` }
    }
    if (key === LEAD_KEY && LEAD_BLOCKED_TOOLS.includes(exec.name)) {
      return { reason: '统筹不直接改文件：用 team_spawn 把实现交给角色智能体（write/edit/apply_patch 由策略拦截）。' }
    }
    if (disabledFor(key).includes(exec.name)) {
      return { reason: key === LEAD_KEY
        ? `「${exec.name}」没有分配给统筹；需要时可在配置页勾选启用。`
        : `「${exec.name}」没有分配给这个角色；需要时向 Lead 报告缺口，由 Lead 协调或调整配置。` }
    }
    return undefined
  }))

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'octagon:roster',
    order: 150,
    text: rosterText(roles),
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'team_spawn',
    description: `拉起一个团队角色完成一项任务，并等待它返回结果。role 取团队角色目录里的 key（${roleKeys.join('、')}）。task 要自带背景、交付物、验收标准与约束；角色看不到你的对话，只能看到你写进 task 的内容和它自己的角色卡。`,
    parameters: {
      role: { type: 'string', required: true, description: `角色 key，可选：${roleKeys.join('、')}` },
      task: { type: 'string', required: true, description: '完整任务单：背景、要交付什么、验收标准、约束与相关文件路径。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'name', 'stop', 'output'],
        properties: {
          role: { type: 'string' },
          name: { type: 'string' },
          stop: { type: 'string' },
          output: { type: 'string' },
          pending: { type: 'array', items: { type: 'string' } },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `[${value.role}${value.stop === 'completed' ? '' : ` · ${value.stop}`}]\n\n${value.output}`,
      }],
    },
    execute: async (args, exec) => {
      if (typeof args?.role !== 'string' || !known.has(args.role)) {
        throw new Error(`未知角色 ${String(args?.role)}；可选：${roleKeys.join('、')}`)
      }
      if (typeof args?.task !== 'string' || args.task.trim() === '') throw new Error('task 不能为空')
      if (!exec.agent) throw new Error('team_spawn 需要一个调用者会话')
      if (isWorker(exec.agent.id)) throw new Error('角色智能体不能再分派；把缺口报告给 Lead。')
      const role = roles.find((entry) => entry.key === args.role)
      const activation = await ctx.subagents.startActivation({
        provider: 'spawn',
        parent: exec.agent,
        label: `${role.emoji} ${role.name}`,
        name: args.role,
        prompt: [{ type: 'text', text: roleCard(role, args.task) }],
        signal: exec.signal,
      })
      markWorker(activation.childId, role.key)
      const result = await activation.result
      const output = result.output
        .map((block) => (block.type === 'text' ? block.text : ''))
        .filter((text) => text !== '')
        .join('\n')
        .trim()
      const pending = pendingFor(role.key).map((request) => `${request.id}:${request.kind}:${request.name}`)
      return {
        role: role.key,
        name: activation.name,
        stop: String(result.stopReason?.kind ?? result.stopReason),
        output: output !== '' ? output : (result.diagnostic ?? '（角色没有返回文本）'),
        pending,
      }
    },
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'request_capability',
    description: '向 Lead 申请一个当前没有分配给本角色的工具或技能。申请不会阻塞：记录后继续用现有工具推进，并在返回结果里说明缺口。',
    parameters: {
      kind: { type: 'string', enum: ['tool', 'skill'], required: true, description: 'tool 表示工具，skill 表示技能。' },
      name: { type: 'string', required: true, description: '工具名（如 write、web_search）或技能目录名（小写字母、数字、连字符）。' },
      reason: { type: 'string', required: true, description: '为什么需要它：要完成什么、没有它卡在哪里。' },
      content: { type: 'string', description: '仅 kind=skill 时填写 SKILL.md 正文；批准后写入角色技能目录。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status', 'kind', 'name'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          kind: { type: 'string' },
          name: { type: 'string' },
          note: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `能力申请已登记（${value.id}）：${value.kind}「${value.name}」等待 Lead 决定。${value.note ?? ''}`,
      }],
    },
    execute: async (args, exec) => {
      const agentId = exec.agent?.id
      if (!agentId || !isWorker(agentId)) throw new Error('request_capability 只能由角色智能体调用')
      const roleKey = workerRole(agentId)
      const kind = args?.kind === 'skill' ? 'skill' : 'tool'
      const name = String(args?.name ?? '').trim()
      if (name === '') throw new Error('name 不能为空')
      if (kind === 'skill' && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
        throw new Error('技能名只能是小写字母、数字与连字符（最长 64）')
      }
      if (kind === 'tool' && !/^[a-z][a-z0-9_]*$/.test(name)) throw new Error('工具名不合法')
      const request = recordRequest({
        roleKey,
        kind,
        name,
        reason: String(args?.reason ?? ''),
        content: typeof args?.content === 'string' ? args.content : '',
        requester: agentId,
      })
      return {
        id: request.id,
        status: request.status,
        kind: request.kind,
        name: request.name,
        note: '先用现有工具继续；Lead 的决定会记录在申请里。',
      }
    },
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'capability_requests',
    description: '查看角色提出的能力申请：待处理的在前，最近已处理的在后。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['pending', 'recent'],
        properties: {
          pending: { type: 'array', items: { type: 'object', additionalProperties: true } },
          recent: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.pending.length === 0
          ? `没有待处理的能力申请${value.recent.length > 0 ? `；最近已处理 ${value.recent.length} 条。` : '。'}`
          : value.pending.map((request) => `- ${request.id} · ${request.roleKey} 申请 ${request.kind}「${request.name}」：${request.reason || '（未写理由）'}`).join('\n'),
      }],
    },
    execute: async () => listRequests(),
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'capability_decide',
    description: '批准或拒绝一条能力申请。批准工具会立即对该角色生效并持久化；批准技能会写入它的技能目录，下一次派生生效。',
    parameters: {
      id: { type: 'string', required: true, description: '申请 id，例如 cap-1a2b3c4d。' },
      decision: { type: 'string', enum: ['approve', 'deny'], required: true, description: 'approve 批准，deny 拒绝。' },
      note: { type: 'string', description: '给角色的说明：为什么批准/拒绝、使用边界。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status', 'applied'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          applied: { type: 'string' },
          role: { type: 'string' },
          name: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `${value.status === 'approved' ? '已批准' : '已拒绝'} ${value.id}：${value.applied}`,
      }],
    },
    execute: async (args) => {
      if (typeof args?.id !== 'string' || args.id === '') throw new Error('id 不能为空')
      if (args.decision !== 'approve' && args.decision !== 'deny') throw new Error('decision 只能是 approve 或 deny')
      const request = decideRequest(args.id, {
        approve: args.decision === 'approve',
        by: 'lead',
        note: typeof args.note === 'string' ? args.note : '',
      })
      const applied = request.status === 'approved'
        ? applyApproval(request)
        : '已记录拒绝，角色未被改动。'
      return { id: request.id, status: request.status, applied, role: request.roleKey, name: request.name }
    },
  }))

  console.info(`[octagon-teams] team runtime mounted with ${roleKeys.length} roles`)
}
