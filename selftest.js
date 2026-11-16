/**
 * End-to-end self test: creates a real session with the team preset, gives it
 * one task, and returns what the run did (tool calls, spawned agents, answer).
 *
 * Used by `POST /octagon-teams/api/selftest` only when the plugin row sets
 * `selftest: true`; it boots no HTTP client and touches no user session.
 * @module selftest
 */

import { randomUUID } from 'node:crypto'
import { loadState, effectiveLead, teamDir } from './state.js'

const TASK_DEFAULT = '用一句话说明你在这个工作区里能做什么。'

/**
 * Drive one blank team session through a single prompt and summarize it.
 * @param {object} ctx - Host context.
 * @param {{ task?: string, cwd?: string }} input - Task text and working directory.
 * @returns {Promise<object>} Run summary.
 */
export async function runSelfTest(ctx, input = {}) {
  const state = loadState()
  const lead = effectiveLead()
  const presetId = state.leadId
  const agents = ctx.agents
  const cwd = input.cwd || process.cwd()
  const task = (input.task || TASK_DEFAULT).trim()

  const sessionId = `session-octagon-selftest-${randomUUID()}`
  const agentOptions = ctx.agentDefaultModel ? ctx.agentDefaultModel.currentSelection() : undefined
  const handle = await agents.create({ sessionId, meta: { cwd, agentPreset: presetId }, agentOptions })
  const agent = handle.agent || handle
  const mounted = ctx.agentPresets.presetForSession
    ? ctx.agentPresets.presetForSession(agent.session)
    : null
  let selected = mounted
  let selectError = ''
  // The creation header records the preset, but the composition is mounted by
  // select(): call it even when the projection already names the preset, since
  // that path also verifies (and recomposes) the agent's scoped plugin tree.
  try {
    selected = await ctx.agentPresets.select(agent, presetId)
  } catch (error) {
    selectError = String(error && error.message || error)
    selected = ctx.agentPresets.presetForSession(agent.session)
  }
  const effective = ctx.agentPresets.presetForSession(agent.session)

  const known = new Set(agents.list().map(a => a.id))
  await agent.whenIdle()
  const seqBefore = agent.session.seq
  const errors = []
  const off = typeof ctx.on === 'function'
    ? ctx.on('agent/error', ({ agent: subject, error }) => { if (subject === agent) errors.push(String(error && error.message || error)) })
    : () => {}

  const started = Date.now()
  agent.followup({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: task }],
    source: { kind: 'user' },
  })
  const queued = agent.inbox ? agent.inbox.nextTurn.length : -1
  await agent.whenIdle()

  const calls = []
  let finalText = ''
  try {
    for (let seq = 0; seq <= agent.session.seq; seq += 1) {
      const event = agent.session.eventAt(seq)
      if (event && event.type === 'tool/call') {
        calls.push({ name: event.data.name, arguments: String(event.data.arguments || '').slice(0, 240) })
      }
      if (event && event.type === 'assistant/message') {
        const content = event.data && event.data.message && event.data.message.content
        if (Array.isArray(content)) {
          const text = content.filter(block => block && block.type === 'text').map(block => block.text).join('\n').trim()
          if (text) finalText = text
        }
      }
    }
  } catch (error) {
    calls.push({ name: '<events unavailable>', arguments: String(error && error.message).slice(0, 200) })
  }

  const children = agents.list()
    .filter(child => !known.has(child.id) && child.id !== sessionId)
    .map(child => ({
      id: child.id,
      calls: childCalls(child),
    }))

  if (typeof off === 'function') off()

  return {
    ok: true,
    mounted,
    selected,
    effective,
    selectError,
    seqBefore,
    seqAfter: agent.session.seq,
    queued,
    errors,
    presetId,
    lead: lead.name !== undefined ? lead.name : 'lead',
    profileDir: teamDir(),
    cwd,
    task,
    sessionId,
    durationMs: Date.now() - started,
    calls,
    children,
    finalText,
  }
}

/**
 * Read a child session's tool calls while it is still live.
 * @param {object} child - Child agent.
 * @returns {string[]} Tool names the child ran.
 */
function childCalls(child) {
  const names = []
  try {
    for (let seq = 0; seq <= child.session.seq; seq += 1) {
      const event = child.session.eventAt(seq)
      if (event && event.type === 'tool/call') names.push(`${event.data.name}`)
    }
  } catch {
    /* a child may already be archived; its calls are only evidence, not control */
  }
  return names
}
