/**
 * Per-agent tool policy for the Octagon team preset.
 *
 * The preset mounts one composition for every agent, so tool availability is a
 * runtime policy: each agent (the coordinator and every spawned role) owns its
 * own disabled set, and `team-runtime` refuses a call outside that set. Tool
 * *visibility* stays shared — the denial is the boundary — so the policy can
 * change without re-mounting a composition.
 *
 * @module policy
 */

/** Key of the coordinator agent in policy tables. */
export const LEAD_KEY = 'lead'

/**
 * Tools only the coordinator may call: spawning and steering other agents is
 * the lead's job, and a role must ask the lead instead of delegating itself or
 * interrupting the user. A role reports open questions in its result; the lead
 * decides whether the user must answer them.
 */
export const LEAD_ONLY_TOOLS = [
  'team_spawn',
  'send_message',
  'list_agents',
  'wait_agent',
  'interrupt_agent',
  'ask_user_question',
  'capability_requests',
  'capability_decide',
]

/**
 * Tools only a role may call. A role that lacks a tool asks the lead through
 * `request_capability`; the lead grants or refuses it.
 */
export const ROLE_ONLY_TOOLS = ['request_capability']

/** Tools the coordinator can never use: it verifies work, it does not write it. */
export const LEAD_BLOCKED_TOOLS = ['write', 'edit', 'apply_patch']

/**
 * Default disabled tools per agent key. Each role starts from the toolset its
 * work needs: implementers keep the full editing surface, designers and writers
 * skip the batch patcher, docs skip image reading, and the reviewer ships
 * read-only. `present` and the task-board write tools stay off for every role:
 * the Lead accepts work and records deliverables after verification.
 * Users may override a role's defaults from the configuration page; the
 * coordinator's write tools stay blocked.
 */
export const DEFAULT_DISABLED = {
  lead: [...LEAD_BLOCKED_TOOLS],
  backend: ['present', 'team_task_create', 'team_task_update'],
  frontend: ['present', 'team_task_create', 'team_task_update'],
  devops: ['present', 'team_task_create', 'team_task_update'],
  qa: ['present', 'team_task_create', 'team_task_update'],
  ui: ['apply_patch', 'present', 'team_task_create', 'team_task_update'],
  ux: ['apply_patch', 'present', 'team_task_create', 'team_task_update'],
  docs: ['apply_patch', 'read_image', 'present', 'team_task_create', 'team_task_update'],
  reviewer: ['write', 'edit', 'apply_patch', 'present', 'team_task_create', 'team_task_update'],
}

/**
 * Tier presets for custom roles. A custom role declares a tier and inherits
 * that tier's shipped toolset until the user edits its tools.
 */
export const TIER_PRESETS = {
  dev: { label: '开发（读+写+bash）', disabled: ['present', 'team_task_create', 'team_task_update'] },
  design: { label: '设计（不批量打补丁）', disabled: ['apply_patch', 'present', 'team_task_create', 'team_task_update'] },
  docs: { label: '文档（不批量打补丁、不看图）', disabled: ['apply_patch', 'read_image', 'present', 'team_task_create', 'team_task_update'] },
  qa: { label: '测试（读+写+bash）', disabled: ['present', 'team_task_create', 'team_task_update'] },
  review: { label: '审查（只读）', disabled: ['write', 'edit', 'apply_patch', 'present', 'team_task_create', 'team_task_update'] },
}

/** Tier names accepted for a custom role. */
export const TIER_NAMES = Object.keys(TIER_PRESETS)

/**
 * Default disabled tools for a capability tier.
 * @param {string} tier - one of {@link TIER_NAMES}.
 * @returns {string[]} copied list.
 */
export function defaultsForTier(tier) {
  return [...(TIER_PRESETS[tier]?.disabled ?? DEFAULT_DISABLED.backend)]
}

/** Live policy by agent key, replaced wholesale on every refresh. @type {Map<string, string[]>} */
const live = new Map()

/**
 * Default disabled tools for one agent key.
 * @param {string} key - `lead` or a role key.
 * @returns {string[]} copied list.
 */
export function defaultsFor(key) {
  return [...(DEFAULT_DISABLED[key] ?? [])]
}

/**
 * Install the effective policy read by the runtime guard.
 * @param {Record<string, string[]>} policy - agent key to disabled tool names.
 */
export function configure(policy) {
  live.clear()
  for (const [key, disabled] of Object.entries(policy ?? {})) {
    live.set(key, Array.isArray(disabled) ? [...disabled] : defaultsFor(key))
  }
}

/**
 * Effective disabled tools for one agent key.
 * @param {string} key - `lead` or a role key.
 * @returns {string[]} disabled tool names.
 */
export function disabledFor(key) {
  return live.get(key) ?? defaultsFor(key)
}

/**
 * Drop one tool from an agent's disabled set, e.g. after the lead approves a
 * capability request. Effective immediately for the running agent; callers also
 * persist the grant so it survives a restart.
 * @param {string} key - role key.
 * @param {string} tool - tool name to enable.
 */
export function grant(key, tool) {
  const current = live.get(key) ?? defaultsFor(key)
  live.set(key, current.filter((name) => name !== tool))
}

/**
 * Validate and normalize a disabled-tool list coming from the configuration page.
 * @param {unknown} value - candidate list.
 * @returns {string[]} trimmed, de-duplicated names.
 */
export function normalizeDisabled(value) {
  if (!Array.isArray(value)) throw new Error('tools must be an array of tool names')
  const names = value.map((name) => {
    if (typeof name !== 'string' || name.trim() === '') throw new Error('every tool name must be a non-empty string')
    return name.trim()
  })
  return [...new Set(names)].slice(0, 200)
}
