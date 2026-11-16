/**
 * Filesystem store for Octagon Teams: profile discovery, id map, the user
 * overlay ("底稿 ⊕ overlay"), and per-role skills.
 *
 * The shipped baseline in `baseline.js` is never rewritten. A role's overlay
 * entry records only the fields the user changed; resetting a role deletes its
 * entry and the baseline shows through again.
 */
import {
  existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASELINE_ROLES, LEAD_PERSONA } from './baseline.js'
import { presetId, uuidv7 } from './uuid7.js'
import { TIER_NAMES, TIER_PRESETS, defaultsFor, defaultsForTier, normalizeDisabled } from './policy.js'

const STATE_VERSION = 1
const OVERLAY_VERSION = 1
const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const LEAD_KEY = 'lead'
const LEAD_NAME = 'Octagon Teams · 统筹'

/** @type {string | undefined} config override for the profile directory. */
let profileOverride

/** @param {string | undefined} dir - explicit profile directory, or undefined to auto-detect. */
export function setProfileDirOverride(dir) {
  profileOverride = dir
}

/** @returns {string | undefined} this bundle's package name. */
function ownPackageName() {
  try {
    return JSON.parse(readFileSync(join(SELF_DIR, 'package.json'), 'utf8')).name
  } catch {
    return undefined
  }
}

/**
 * Find the profile that installed this bundle. The Host process may lack
 * `DSH_PROFILE_DIR`, so fall back to the profile whose `node_modules` entry
 * resolves to this bundle's own directory.
 * @returns {string} absolute profile directory.
 */
export function resolveProfileDir() {
  if (profileOverride) return profileOverride
  if (process.env.DSH_PROFILE_DIR) return process.env.DSH_PROFILE_DIR
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const profiles = join(home, 'profiles')
  const name = ownPackageName()
  let self = SELF_DIR
  try { self = realpathSync(SELF_DIR) } catch {}
  if (name) {
    let entries = []
    try { entries = readdirSync(profiles) } catch {}
    for (const profile of entries) {
      try {
        if (realpathSync(join(profiles, profile, 'node_modules', name)) === self) {
          return join(profiles, profile)
        }
      } catch {}
    }
  }
  return join(profiles, process.env.DSH_PROFILE ?? 'default')
}

/** @returns {string} this bundle's state directory inside the profile. */
export function teamDir() {
  const dir = join(resolveProfileDir(), 'octagon-teams')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** @param {string} key - role key or `lead`. @returns {string} that agent's skill root. */
export function skillDir(key) {
  const dir = join(teamDir(), 'roles', key, 'skills')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Load the persisted preset-id map, seeding one UUIDv7 per missing role.
 * @returns {{version:number, leadId:string, roles:Record<string,string>}}
 */
export function loadState() {
  const file = join(teamDir(), 'state.json')
  let state
  try {
    state = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    state = { version: STATE_VERSION, leadId: presetId(uuidv7()), roles: {} }
  }
  if (typeof state.leadId !== 'string') state.leadId = presetId(uuidv7())
  if (typeof state.roles !== 'object' || state.roles === null) state.roles = {}
  for (const role of BASELINE_ROLES) {
    if (typeof state.roles[role.key] !== 'string') state.roles[role.key] = presetId(uuidv7())
  }
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`)
  return state
}

/** @typedef {{name:string, emoji:string, requirement:string, persona:string, tier:string, tools?:string[]}} CustomRole */

/**
 * Read the overlay: per-role field edits plus user-created roles.
 * @returns {{version:number, roles:Record<string, {name?:string, emoji?:string, requirement?:string, persona?:string, tools?:string[]}>, custom:Record<string, CustomRole>}}
 */
export function loadOverlay() {
  try {
    const parsed = JSON.parse(readFileSync(join(teamDir(), 'overlay.json'), 'utf8'))
    const roles = parsed && typeof parsed.roles === 'object' && parsed.roles !== null ? parsed.roles : {}
    const custom = parsed && typeof parsed.custom === 'object' && parsed.custom !== null ? parsed.custom : {}
    const grants = parsed && typeof parsed.grants === 'object' && parsed.grants !== null ? parsed.grants : {}
    return { version: OVERLAY_VERSION, roles, custom, grants }
  } catch {}
  return { version: OVERLAY_VERSION, roles: {}, custom: {}, grants: {} }
}

/** @param {ReturnType<typeof loadOverlay>} overlay - value to persist. */
export function saveOverlay(overlay) {
  writeFileSync(join(teamDir(), 'overlay.json'), `${JSON.stringify(overlay, null, 2)}\n`)
}

/** Lead's baseline fields, merged with any overlay edits. */
export function effectiveLead(overlay = loadOverlay()) {
  const edit = overlay.roles[LEAD_KEY] ?? {}
  return {
    key: LEAD_KEY,
    name: LEAD_NAME,
    emoji: '🦑',
    requirement: '负责拆解、分派、验收与对用户汇报；没有写实现文件的工具。',
    tier: 'lead',
    baselinePersona: LEAD_PERSONA,
    persona: typeof edit.persona === 'string' ? edit.persona : LEAD_PERSONA,
    disabled: withoutGrants(Array.isArray(edit.tools) ? edit.tools : defaultsFor(LEAD_KEY), overlay.grants, LEAD_KEY),
    customized: Object.keys(edit).length > 0,
  }
}

/**
 * Baseline roles merged with overlay edits, then user-created roles, in order.
 * @returns {Array<{key:string,name:string,emoji:string,requirement:string,persona:string,tier:string,customized:boolean,custom:boolean}>}
 */
export function effectiveRoles(overlay = loadOverlay()) {
  const custom = Object.entries(overlay.custom ?? {}).map(([key, role]) => ({
    key,
    name: role.name,
    emoji: role.emoji || '🧩',
    requirement: role.requirement,
    persona: role.persona,
    tier: role.tier,
    disabled: withoutGrants(Array.isArray(role.tools) ? role.tools : defaultsForTier(role.tier), overlay.grants, key),
    customized: true,
    custom: true,
  }))
  const shipped = BASELINE_ROLES.map((role) => {
    const edit = overlay.roles[role.key] ?? {}
    const pick = (field, fallback) => (typeof edit[field] === 'string' && edit[field].trim() !== '' ? edit[field] : fallback)
    return {
      key: role.key,
      name: pick('name', role.name),
      emoji: pick('emoji', role.emoji),
      requirement: pick('requirement', role.requirement),
      persona: pick('persona', role.persona),
      tier: role.toolset,
      disabled: withoutGrants(Array.isArray(edit.tools) ? edit.tools : defaultsFor(role.key), overlay.grants, role.key),
      customized: Object.keys(edit).length > 0,
      custom: false,
    }
  })
  return [...shipped, ...custom]
}

/**
 * Remove approved grants from a disabled list.
 * @param {string[]} disabled - configured disabled tools.
 * @param {Record<string, string[]>} grants - approved tool names per key.
 * @param {string} key - agent key.
 * @returns {string[]} disabled list without granted tools.
 */
function withoutGrants(disabled, grants, key) {
  const granted = Array.isArray(grants?.[key]) ? grants[key] : []
  return granted.length === 0 ? disabled : disabled.filter((tool) => !granted.includes(tool))
}

/**
 * Persist an approved capability: the tool stays enabled across restarts.
 * @param {string} key - role key.
 * @param {string} tool - tool name.
 * @returns {string[]} the role's grants.
 */
export function grantTool(key, tool) {
  const overlay = loadOverlay()
  const current = Array.isArray(overlay.grants[key]) ? overlay.grants[key] : []
  overlay.grants[key] = [...new Set([...current, tool])]
  saveOverlay(overlay)
  return overlay.grants[key]
}

/**
 * @param {string} key - role key.
 * @returns {string[]} approved tool names.
 */
export function toolGrants(key) {
  const grants = loadOverlay().grants[key]
  return Array.isArray(grants) ? grants : []
}

/** @param {string} key - role key or lead. @returns {boolean} */
export function isKnownKey(key) {
  if (key === LEAD_KEY) return true
  if (BASELINE_ROLES.some((role) => role.key === key)) return true
  return Object.hasOwn(loadOverlay().custom, key)
}

const MAX = { name: 60, emoji: 8, requirement: 300, persona: 20000 }

/** Capability tiers a custom role may declare. @returns {Array<{name:string,label:string}>} */
export function roleTiers() {
  return TIER_NAMES.map((name) => ({ name, label: TIER_PRESETS[name]?.label ?? name }))
}

/** @param {string} key - existing custom role key. @returns {boolean} */
function isCustomKey(key) {
  return Object.hasOwn(loadOverlay().custom, key)
}

/** @param {Record<string, CustomRole>} custom - existing custom roles. @returns {string} unused key. */
function nextCustomKey(custom) {
  let index = 1
  while (Object.hasOwn(custom, `custom-${index}`)) index += 1
  return `custom-${index}`
}

/**
 * Create a user-defined role. It joins the team roster, the `team_spawn`
 * enumeration and its own skills directory immediately.
 * @param {{name?:unknown, emoji?:unknown, requirement?:unknown, persona?:unknown, tier?:unknown}} input - form values.
 * @returns {ReturnType<typeof effectiveRoles>} refreshed role list.
 */
export function createRole(input) {
  const text = (field, max, required) => {
    const value = typeof input[field] === 'string' ? input[field].trim() : ''
    if (required && value === '') throw new Error(`${field} 不能为空`)
    if (value.length > max) throw new Error(`${field} 超过 ${max} 字符`)
    return value
  }
  const name = text('name', MAX.name, true)
  const requirement = text('requirement', MAX.requirement, true)
  const persona = text('persona', MAX.persona, true)
  const emoji = text('emoji', MAX.emoji, false) || '🧩'
  const tier = typeof input.tier === 'string' && TIER_NAMES.includes(input.tier) ? input.tier : 'dev'
  const overlay = loadOverlay()
  const key = nextCustomKey(overlay.custom)
  overlay.custom[key] = { name, emoji, requirement, persona, tier }
  saveOverlay(overlay)
  skillDir(key)
  return { lead: effectiveLead(overlay), roles: effectiveRoles(overlay) }
}

/**
 * Delete a user-defined role and its skill directory. Baseline roles cannot be
 * deleted; reset them instead.
 * @param {string} key - custom role key.
 * @returns {ReturnType<typeof effectiveRoles>} refreshed role list.
 */
export function deleteRole(key) {
  if (!isCustomKey(key)) throw new Error('只有自定义角色可以删除；内置角色请用「恢复默认」')
  const overlay = loadOverlay()
  delete overlay.custom[key]
  delete overlay.roles[key]
  delete overlay.grants[key]
  saveOverlay(overlay)
  rmSync(join(teamDir(), 'roles', key), { recursive: true, force: true })
  return { lead: effectiveLead(overlay), roles: effectiveRoles(overlay) }
}

/**
 * Drop a role's tool-policy override, restoring its shipped defaults.
 * @param {string} key - role key or lead.
 * @returns {{lead: object, roles: object[]}} effective configuration.
 */
export function resetTools(key) {
  if (!isKnownKey(key)) throw new Error(`unknown role: ${key}`)
  const overlay = loadOverlay()
  const entry = { ...(overlay.roles[key] ?? {}) }
  delete overlay.grants[key]
  if ('tools' in entry) {
    delete entry.tools
    if (Object.keys(entry).length === 0) delete overlay.roles[key]
    else overlay.roles[key] = entry
  }
  saveOverlay(overlay)
  return { lead: effectiveLead(overlay), roles: effectiveRoles(overlay) }
}

/**
 * Apply validated edits to one role's overlay entry.
 * @param {string} key - role key or lead.
 * @param {Record<string, unknown>} patch - subset of name/emoji/requirement/persona.
 * @returns {ReturnType<typeof effectiveRoles>} refreshed role list.
 */
export function updateRole(key, patch) {
  if (!isKnownKey(key)) throw new Error(`unknown role: ${key}`)
  const overlay = loadOverlay()
  const entry = { ...(overlay.roles[key] ?? {}) }
  for (const field of Object.keys(MAX)) {
    const value = patch[field]
    if (value === undefined) continue
    if (typeof value !== 'string') throw new Error(`${field} must be a string`)
    const text = value.trim()
    if (field === 'persona') {
      if (text.length === 0) throw new Error('persona must not be empty')
    }
    if (text.length > MAX[field]) throw new Error(`${field} exceeds ${MAX[field]} characters`)
    entry[field] = text
  }
  if (patch.tools !== undefined) entry.tools = normalizeDisabled(patch.tools)
  overlay.roles[key] = entry
  saveOverlay(overlay)
  return { lead: effectiveLead(overlay), roles: effectiveRoles(overlay) }
}

/** @param {string} key - role key or lead. */
export function resetRole(key) {
  if (!isKnownKey(key)) throw new Error(`unknown role: ${key}`)
  if (isCustomKey(key)) throw new Error('自定义角色没有底稿；删除它即可')
  const overlay = loadOverlay()
  delete overlay.roles[key]
  delete overlay.grants[key]
  saveOverlay(overlay)
  return { lead: effectiveLead(overlay), roles: effectiveRoles(overlay) }
}

/** Drop every field override of the shipped roles; user-created roles stay. */
export function resetAll() {
  const overlay = loadOverlay()
  const grantedKeys = Object.keys(overlay.grants)
  const keptGrants = {}
  for (const key of grantedKeys) {
    if (Object.hasOwn(overlay.custom, key)) keptGrants[key] = overlay.grants[key]
  }
  saveOverlay({ version: OVERLAY_VERSION, roles: {}, custom: overlay.custom, grants: keptGrants })
  const fresh = loadOverlay()
  return { lead: effectiveLead(fresh), roles: effectiveRoles(fresh) }
}

const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

/** @param {unknown} name - candidate skill folder name. @returns {string} validated name. */
function assertSkillName(name) {
  if (typeof name !== 'string' || !SKILL_NAME.test(name)) {
    throw new Error('skill name must be lowercase letters, digits and dashes (max 64)')
  }
  return name
}

/**
 * List one agent's skills (folders holding SKILL.md).
 * @param {string} key - role key or lead.
 * @returns {Array<{name:string, title:string, bytes:number}>}
 */
export function listSkills(key) {
  const root = skillDir(key)
  const skills = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const dir = join(root, entry.name)
    let isDirectory = entry.isDirectory()
    if (!isDirectory && entry.isSymbolicLink()) {
      try { isDirectory = statSync(dir).isDirectory() } catch { isDirectory = false }
    }
    if (!isDirectory) continue
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file)) continue
    const content = readFileSync(file, 'utf8')
    const heading = content.match(/^#\s+(.+)$/m)
    let linked = false
    try { linked = lstatSync(dir).isSymbolicLink() } catch {}
    skills.push({ name: entry.name, title: heading ? heading[1].trim() : entry.name, bytes: Buffer.byteLength(content), linked })
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

/** Read SKILL.md text; @returns {string} */
export function readSkill(key, name) {
  const file = join(skillDir(key), assertSkillName(name), 'SKILL.md')
  if (!existsSync(file)) throw new Error(`skill not found: ${name}`)
  return readFileSync(file, 'utf8')
}

/** Create or overwrite SKILL.md; @returns {void} */
export function writeSkill(key, name, content) {
  assertSkillName(name)
  if (typeof content !== 'string' || content.trim() === '') throw new Error('SKILL.md content must not be empty')
  if (Buffer.byteLength(content) > 256 * 1024) throw new Error('SKILL.md exceeds 256 KiB')
  const dir = join(skillDir(key), name)
  let linked = false
  try { linked = lstatSync(dir).isSymbolicLink() } catch {}
  if (linked) throw new Error(`技能 ${name} 来自已安装技能（只读链接），先取消选择再编辑`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), content.endsWith('\n') ? content : `${content}\n`)
}

/** Delete one skill folder; @returns {void} */
export function deleteSkill(key, name) {
  const dir = join(skillDir(key), assertSkillName(name))
  if (!existsSync(dir)) throw new Error(`skill not found: ${name}`)
  rmSync(dir, { recursive: true, force: true })
}

/* ------------------------------------------------------------------ */
/* Installed skills from the skill marketplace and per-agent selection */
/* ------------------------------------------------------------------ */

const SELECTION_FILE = 'selected-skills.json'

/**
 * Candidate skill-marketplace roots, most local first, with duplicates removed.
 * These mirror the default roots of `dsh-skill-filesystem`.
 * @returns {Array<{source:string, dir:string}>}
 */
export function marketplaceRoots() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const agentsHome = process.env.DSH_AGENTS_HOME ?? join(homedir(), '.agents')
  const cwd = process.cwd()
  const roots = [
    { source: '项目 .dsh', dir: join(cwd, '.dsh', 'skills') },
    { source: '项目 .agents', dir: join(cwd, '.agents', 'skills') },
    { source: '用户 .dsh', dir: join(home, 'skills') },
    { source: '用户 .agents', dir: join(agentsHome, 'skills') },
  ]
  const seen = new Set()
  const unique = []
  for (const root of roots) {
    let real = root.dir
    try { real = realpathSync(root.dir) } catch { continue }
    if (seen.has(real)) continue
    seen.add(real)
    unique.push({ source: root.source, dir: real })
  }
  return unique
}

/** @param {string} content - SKILL.md text. @returns {string} short catalog description. */
function skillDescription(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (frontmatter) {
    const line = frontmatter[1].match(/^description:\s*(.+)$/m)
    if (line) return line[1].trim().replace(/^['"]|['"]$/g, '').slice(0, 160)
  }
  for (const paragraph of content.split(/\r?\n\s*\r?\n/)) {
    const text = paragraph.replace(/^#+\s*/gm, '').trim()
    if (text && !text.startsWith('---')) return text.replace(/\s+/g, ' ').slice(0, 160)
  }
  return ''
}

/**
 * Every skill installed through the skill marketplace (any default root).
 * @returns {Array<{name:string, title:string, source:string, description:string, dir:string}>}
 */
export function installedSkills() {
  const found = []
  const seen = new Set()
  for (const root of marketplaceRoots()) {
    let entries = []
    try { entries = readdirSync(root.dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      const dir = join(root.dir, entry.name)
      let isDirectory = entry.isDirectory()
      if (!isDirectory && entry.isSymbolicLink()) {
        try { isDirectory = statSync(dir).isDirectory() } catch { isDirectory = false }
      }
      if (!isDirectory) continue
      const file = join(dir, 'SKILL.md')
      if (!existsSync(file)) continue
      let real = dir
      try { real = realpathSync(dir) } catch {}
      if (seen.has(real)) continue
      seen.add(real)
      const content = readFileSync(file, 'utf8')
      const heading = content.match(/^#\s+(.+)$/m)
      found.push({
        name: entry.name,
        title: heading ? heading[1].trim() : entry.name,
        source: root.source,
        description: skillDescription(content),
        dir: real,
      })
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

/** @param {string} key - agent key. @returns {string[]} selected marketplace skill names. */
export function selectedSkillNames(key) {
  try {
    const parsed = JSON.parse(readFileSync(join(teamDir(), 'roles', key, SELECTION_FILE), 'utf8'))
    return Array.isArray(parsed.names) ? parsed.names.filter((name) => typeof name === 'string') : []
  } catch {
    return []
  }
}

/** @param {string} key - agent key. @param {string[]} names - selected marketplace skill names. */
function saveSelectedSkillNames(key, names) {
  const dir = join(teamDir(), 'roles', key)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, SELECTION_FILE), `${JSON.stringify({ names: [...new Set(names)].sort() }, null, 2)}\n`)
}

/**
 * Make the agent's skills directory mirror its selection: one symlink per
 * selected marketplace skill, and no stale links. Real folders (uploaded or
 * hand-written skills) are never touched.
 * @param {string} key - agent key.
 * @returns {{linked:string[], missing:string[], conflicts:string[]}}
 */
export function syncSelectedSkills(key) {
  const root = skillDir(key)
  const installed = new Map(installedSkills().map((skill) => [skill.name, skill.dir]))
  const names = selectedSkillNames(key)
  const wanted = new Set(names.filter((name) => installed.has(name)))
  const linked = []
  const missing = names.filter((name) => !installed.has(name))
  const conflicts = []

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue
    if (!wanted.has(entry.name)) {
      try { unlinkSync(join(root, entry.name)) } catch {}
    }
  }

  for (const name of wanted) {
    const link = join(root, name)
    const target = installed.get(name)
    let existing
    try { existing = lstatSync(link) } catch { existing = undefined }
    if (existing) {
      if (!existing.isSymbolicLink()) { conflicts.push(name); continue }
      let current = ''
      try { current = realpathSync(link) } catch {}
      if (current === target) { linked.push(name); continue }
      try { unlinkSync(link) } catch {}
    }
    try { symlinkSync(target, link, 'dir') } catch (error) {
      conflicts.push(name)
      continue
    }
    linked.push(name)
  }

  return { linked, missing, conflicts }
}

/**
 * Toggle one marketplace skill on/off for an agent.
 * @param {string} key - agent key.
 * @param {string} name - marketplace skill folder name.
 * @param {boolean} selected - desired state.
 * @returns {ReturnType<typeof skillsPayload>}
 */
export function setSkillSelected(key, name, selected) {
  assertSkillName(name)
  if (!installedSkills().some((skill) => skill.name === name)) throw new Error(`未安装该技能：${name}`)
  const names = new Set(selectedSkillNames(key))
  if (selected) names.add(name)
  else names.delete(name)
  saveSelectedSkillNames(key, [...names])
  return skillsPayload(key)
}

/**
 * One agent's full skill view: uploaded/hand-written folders plus the installed
 * marketplace skills and which of them are selected.
 * @param {string} key - agent key.
 */
export function skillsPayload(key) {
  const sync = syncSelectedSkills(key)
  const installed = installedSkills().map((skill) => ({
    name: skill.name,
    title: skill.title,
    source: skill.source,
    description: skill.description,
    selected: existsSync(join(skillDir(key), skill.name)),
  }))
  return { local: listSkills(key), installed, selected: selectedSkillNames(key), sync }
}
