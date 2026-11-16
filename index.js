/**
 * Octagon Teams: registers ONE team preset at runtime and serves the
 * configuration port at `/octagon-teams`.
 *
 * Why one preset: the preset picker lists every registered preset, so a role
 * must not be a preset of its own. The team is a single selectable mode; roles
 * are started on demand by the preset's own `team_spawn` tool (`team-runtime.js`)
 * and inherit this composition. Ids are `octagon-<uuidv7>`; the shipped baseline
 * never changes and user edits live in an overlay file (`data.js`).
 */
import { readFileSync } from 'node:fs'
import { renderPage } from './page.js'
import { runSelfTest } from './selftest.js'
import { describeTools, missingTools } from './tools.js'
import { decideRequest, listRequests } from './requests.js'
import { applyApproval } from './capability.js'
import { LEAD_BLOCKED_TOOLS, LEAD_KEY, LEAD_ONLY_TOOLS, ROLE_ONLY_TOOLS, configure } from './policy.js'
import {
  createRole, deleteRole, deleteSkill, effectiveLead, effectiveRoles, loadState, readSkill, resetAll,
  resetRole, resetTools, resolveProfileDir, roleTiers, setProfileDirOverride, setSkillSelected,
  skillsPayload, toolGrants, updateRole, writeSkill,
} from './state.js'

export const name = 'octagon-teams'

/** This bundle's version, reported by `/api/health` so installs can be compared. */
const PACKAGE_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version ?? null
  } catch {
    return null
  }
})()
// `webServer` must be injected, not probed with ctx.get(): on a cold boot the
// service is not registered yet when this entry applies, and an early return
// would leave the configuration port unrouted until the next reload.
// `agents` and `agentDefaultModel` are only used by the optional self test, so
// they stay out of `inject`: requiring them would leave the whole entry pending
// (and the team preset unregistered) on installs whose DSH build lacks them.
export const inject = ['agentPresets', 'webServer']

const PAGE_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

/** The team preset's picker order. */
const TEAM_ORDER = 10

/** Tools this team deliberately does not mount: spawning is `team_spawn`, skills are inlined per role. */
const DESIGNED_ABSENT = ['subagent', 'skill']

/** Tools only the spawned roles may run; the coordinator is refused by team-runtime. */
const COORDINATOR_BLOCKED = ['write', 'edit', 'apply_patch']

/** Tool rows of the team composition, shared by the coordinator and every role. */
function teamRows() {
  return [
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs', config: { read: true, readImage: true, write: true, edit: true, applyPatch: true } },
    // `sampleOverCapGlobResults` has no default and the row refuses to mount without it.
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: true } },
    { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
    { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
    { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true } },
    { id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' },
    { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
    { id: 'tool-agent-team', name: '@deepseek-ai/dsh-tool-agent-team' },
    { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
    { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
    { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
    { id: 'team-runtime', name: '@hexa-center/octagon-teams/runtime', config: { profileDir: resolveProfileDir() } },
    { id: 'delegation', name: 'cordis:group', group: true, isolate: { workflowEngine: true }, config: [
      { id: 'tool-subagent-control', name: '@deepseek-ai/dsh-tool-subagent-control', config: { interrupt: false } },
    ] },
    { id: 'compaction', name: 'cordis:group', group: true, isolate: { compaction: true, toolResultPruner: true }, config: [
      { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
      { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
      { id: 'tool-result-pruner', name: '@deepseek-ai/dsh-compaction-tool-result-pruner', config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } },
    ] },
  ]
}

/**
 * Build the single team preset from the effective coordinator fields.
 * @param {ReturnType<typeof effectiveLead>} lead - effective coordinator fields.
 * @param {{leadId:string}} state - persisted id map (leadId is the team preset id).
 */
function teamPreset(lead, state) {
  return {
    id: state.leadId,
    name: 'Octagon Teams',
    description: lead.requirement,
    order: TEAM_ORDER,
    plugins: [
      { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: lead.persona } },
      ...teamRows(),
    ],
  }
}

/** @returns {{state: object, lead: object, roles: object[], definition: object}} current composition. */
function definitions() {
  const state = loadState()
  return {
    state,
    lead: effectiveLead(),
    roles: effectiveRoles(),
    definition: teamPreset(effectiveLead(), state),
  }
}

/**
 * Public view of one agent: effective fields plus the tools the team preset mounts.
 * @param {object} fields - effective lead/role fields.
 * @param {object} definition - the team preset.
 * @param {{worker?: boolean}} [extra] - worker marker for role rows.
 * @param {string[]} [hidden] - tool names this agent never sees.
 */
function viewOf(fields, definition, extra = {}, hidden = []) {
  const tools = describeTools(definition, hidden)
  return {
    ...fields,
    ...extra,
    tools,
    missing: missingTools(definition).filter((tool) => !COORDINATOR_BLOCKED.includes(tool) && !DESIGNED_ABSENT.includes(tool)),
  }
}

/** @returns {{lead: object, roles: object[], leadId: string, profileDir: string}} configuration payload. */
function rolesPayload(origin) {
  const current = definitions()
  const definition = current.definition
  return {
    lead: {
      ...viewOf(current.lead, definition, { granted: toolGrants(LEAD_KEY) }, ROLE_ONLY_TOOLS),
      blocked: COORDINATOR_BLOCKED,
      leadOnly: LEAD_ONLY_TOOLS,
      requestOnly: ROLE_ONLY_TOOLS,
    },
    roles: current.roles.map((role) => viewOf(role, definition, {
      worker: true,
      leadOnly: LEAD_ONLY_TOOLS,
      granted: toolGrants(role.key),
    }, LEAD_ONLY_TOOLS)),
    leadId: current.state.leadId,
    profileDir: resolveProfileDir(),
    tiers: roleTiers(),
    origin: origin || null,
  }
}

/**
 * Auto-enable Team mode for a newly created team session.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 * @param {any} agent - Created agent handle.
 * @param {string} teamId - Octagon team preset id.
 * @param {number} attempt - Retry counter while the preset projection is not ready.
 */
async function enableTeam(ctx, agent, teamId, attempt) {
  try {
    const session = ctx.get('sessions')?.get(agent.id)
    if (!session) {
      if (attempt < 20) setTimeout(() => { enableTeam(ctx, agent, teamId, attempt + 1) }, 100)
      return
    }
    const selected = session.header.agentPreset ?? ctx.agentPresets.presetForSession(session)
    if (selected === teamId) {
      if (ctx.agentTeams?.setEnabled) await ctx.agentTeams.setEnabled(agent, true)
      return
    }
    if ((selected === undefined || selected === null) && attempt < 20) {
      setTimeout(() => { enableTeam(ctx, agent, teamId, attempt + 1) }, 100)
    }
  } catch (error) {
    console.error('[octagon-teams] enabling Team mode failed:', error)
  }
}

/** @param {import('node:http').IncomingMessage} req - request whose body is JSON. */
async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('request body exceeds 1 MB')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('request body is not valid JSON')
  }
}

/** @param {import('node:http').ServerResponse} res - response to finish. */
function send(res, status, body, headers = JSON_HEADERS) {
  res.writeHead(status, headers)
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

/**
 * Register the team preset and serve the configuration port.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
 * @param {{autoTeamMode?: boolean, profileDir?: string, selftest?: boolean}} config - Row config.
 */
export async function apply(ctx, config = {}) {
  if (typeof config.profileDir === 'string' && config.profileDir.trim() !== '') {
    setProfileDirOverride(config.profileDir.trim())
  }
  /** @type {Map<string, () => Promise<void>>} live preset id → disposer. */
  const registry = new Map()

  /** Register one definition, replacing an older registration with the same id. */
  async function install(definition) {
    const previous = registry.get(definition.id)
    if (previous) {
      registry.delete(definition.id)
      try { await previous() } catch (error) { console.error('[octagon-teams] disposing old preset failed:', error) }
    }
    try {
      registry.set(definition.id, await ctx.agentPresets.register(definition))
    } catch (error) {
      console.error(`[octagon-teams] registering preset ${definition.id} failed:`, error)
    }
  }

  /** Push the effective per-agent tool policy into the runtime guard. */
  function syncPolicy() {
    const current = definitions()
    /** @type {Record<string, string[]>} */
    const policy = { lead: current.lead.disabled }
    for (const role of current.roles) policy[role.key] = role.disabled
    configure(policy)
  }

  /** Re-register the team preset after an edit; new sessions pick it up. */
  async function refresh() {
    syncPolicy()
    await install(definitions().definition)
  }

  const initial = definitions()
  syncPolicy()
  await install(initial.definition)
  console.info(`[octagon-teams] registered team preset ${initial.state.leadId}`)

  ctx.effect(() => async () => {
    const disposers = [...registry.values()].reverse()
    registry.clear()
    for (const dispose of disposers) {
      try { await dispose() } catch (error) { console.error('[octagon-teams] disposing preset failed:', error) }
    }
  })

  if (config.autoTeamMode !== false) {
    ctx.on('agent/created', ({ agent }) => { void enableTeam(ctx, agent, initial.state.leadId, 0) })
  }

  const webServer = ctx.webServer
  if (!webServer) {
    console.warn('[octagon-teams] no webServer service: configuration port is unavailable')
    return
  }
  /**
   * The origin the HTTP listener is bound to right now. Read per request: the
   * desktop shell picks the port at startup, so a restart changes it.
   * @returns {string} `http://host:port`, or an empty string before listening.
   */
  const currentOrigin = () => (typeof webServer.getOrigin === 'function' ? webServer.getOrigin() : '')

  /**
   * The composed Client entry for this bundle, when the web client composed one.
   * @param {import('@deepseek-ai/cordis').Context} ctx - Host context.
   * @returns {{url: string, rev: string, immediately?: boolean} | null} entry or null.
   */
  function clientEntry(ctx) {
    try {
      const graph = ctx.get('clientModules')?.graph?.()
      const entry = graph?.entries?.find((item) => item.id === '@hexa-center/octagon-teams')
      if (entry === undefined) return null
      return { url: entry.url, rev: entry.rev, immediately: entry.immediately }
    } catch {
      return null
    }
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://octagon-teams.local')
    const path = url.pathname.replace(/^\/octagon-teams/, '')
    const method = req.method ?? 'GET'
    try {
      if (path === '' || path === '/') {
        if (method !== 'GET' && method !== 'HEAD') return send(res, 405, { error: 'method not allowed' })
        return send(res, 200, renderPage({ origin: currentOrigin() }), PAGE_HEADERS)
      }
      if (path === '/health' || path === '/api/health') {
        const presets = await ctx.agentPresets.list()
        return send(res, 200, {
          version: PACKAGE_VERSION,
          team: definitions().state.leadId,
          profileDir: resolveProfileDir(),
          registered: presets.length,
          presets: presets.map((preset) => ({
            id: preset.id,
            name: preset.name ?? null,
            broken: preset.broken ?? null,
          })),
          services: {
            agentPresets: Boolean(ctx.get('agentPresets')),
            webServer: Boolean(ctx.get('webServer')),
            agents: Boolean(ctx.get('agents')),
            agentDefaultModel: Boolean(ctx.get('agentDefaultModel')),
            subagents: Boolean(ctx.get('subagents')),
            agentTeams: Boolean(ctx.get('agentTeams')),
          },
          selftest: config.selftest === true,
          client: clientEntry(ctx),
        })
      }
      if (!path.startsWith('/api/')) return send(res, 404, { error: `no route for ${path}` })

      const segments = path.slice('/api/'.length).split('/').map(decodeURIComponent)
      const [resource, key, name] = segments

      if (resource === 'capabilities') {
        if (!key) {
          if (method !== 'GET') return send(res, 405, { error: 'method not allowed' })
          return send(res, 200, listRequests())
        }
        if (name === 'decide') {
          if (method !== 'POST') return send(res, 405, { error: 'method not allowed' })
          const body = await readJson(req)
          const request = decideRequest(key, { approve: body.approve !== false, by: 'user', note: body.note ?? '' })
          if (request.status === 'approved') applyApproval(request)
          return send(res, 200, { request, ...listRequests() })
        }
        return send(res, 405, { error: 'method not allowed' })
      }

      if (resource === 'selftest') {
        if (method !== 'POST') return send(res, 405, { error: 'method not allowed' })
        if (config.selftest !== true) return send(res, 404, { error: 'selftest is disabled (set `selftest: true` on the octagon-teams row)' })
        const agents = ctx.get('agents')
        const agentDefaultModel = ctx.get('agentDefaultModel')
        if (!agents || !agentDefaultModel) {
          return send(res, 503, { error: 'selftest needs the agents and agentDefaultModel services, which this DSH build does not expose' })
        }
        return send(res, 200, await runSelfTest(ctx, await readJson(req), { agents, agentDefaultModel }))
      }

      if (resource === 'roles' && !key) {
        if (method === 'GET') return send(res, 200, rolesPayload(currentOrigin()))
        if (method === 'POST') {
          createRole(await readJson(req))
          await refresh()
          return send(res, 200, rolesPayload(currentOrigin()))
        }
        return send(res, 405, { error: 'method not allowed' })
      }

      if (resource === 'roles' && key) {
        if (method === 'PUT') {
          updateRole(key, await readJson(req))
          await refresh()
        } else if (method === 'POST' && name === 'reset') {
          resetRole(key)
          await refresh()
        } else if (method === 'POST' && name === 'tools' && segments[3] === 'reset') {
          resetTools(key)
          await refresh()
        } else if (method === 'DELETE' && !name) {
          deleteRole(key)
          await refresh()
        } else {
          return send(res, 405, { error: 'method not allowed' })
        }
        return send(res, 200, rolesPayload(currentOrigin()))
      }

      if (resource === 'reset') {
        if (method !== 'POST') return send(res, 405, { error: 'method not allowed' })
        resetAll()
        await refresh()
        return send(res, 200, rolesPayload(currentOrigin()))
      }

      if (resource === 'skills' && key) {
        if (!name) {
          if (method === 'GET') return send(res, 200, skillsPayload(key))
          if (method === 'POST') {
            const body = await readJson(req)
            writeSkill(key, body.name, body.content)
            return send(res, 200, skillsPayload(key))
          }
          return send(res, 405, { error: 'method not allowed' })
        }
        if (name === 'select') {
          if (method !== 'PUT') return send(res, 405, { error: 'method not allowed' })
          const body = await readJson(req)
          if (typeof body.name !== 'string') throw new Error('name is required')
          return send(res, 200, setSkillSelected(key, body.name, body.selected !== false))
        }
        if (method === 'GET') return send(res, 200, { name, content: readSkill(key, name) })
        if (method === 'PUT') {
          const body = await readJson(req)
          writeSkill(key, name, body.content)
          return send(res, 200, { ok: true, ...skillsPayload(key) })
        }
        if (method === 'DELETE') {
          deleteSkill(key, name)
          return send(res, 200, { ok: true, ...skillsPayload(key) })
        }
        return send(res, 405, { error: 'method not allowed' })
      }

      return send(res, 404, { error: `no route for ${path}` })
    } catch (error) {
      console.error('[octagon-teams] configuration request failed:', error)
      return send(res, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  ctx.effect(() => webServer.register({ kind: 'prefix', path: '/octagon-teams', handler: handle }))
  console.info(`[octagon-teams] configuration port ready at ${currentOrigin()}/octagon-teams`)
}
