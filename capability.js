/**
 * Apply an approved capability request.
 *
 * A tool grant is persisted (so it survives a restart) and pushed into the live
 * per-agent policy (so the running role can use it immediately). A skill grant
 * writes the proposed SKILL.md into the role's own skill directory; the next
 * time that role is spawned, its role card carries the skill.
 *
 * @module capability
 */
import { effectiveLead, effectiveRoles, grantTool, writeSkill } from './state.js'
import { configure } from './policy.js'

/**
 * Push the persisted policy into the live registry.
 * @returns {void}
 */
export function syncLivePolicy() {
  const lead = effectiveLead()
  const policy = { lead: lead.disabled }
  for (const role of effectiveRoles()) policy[role.key] = role.disabled
  configure(policy)
}

/**
 * Apply one approved request.
 * @param {{roleKey:string, kind:string, name:string, content?:string}} request - approved request.
 * @returns {string} human-readable effect.
 */
export function applyApproval(request) {
  if (request.kind === 'tool') {
    grantTool(request.roleKey, request.name)
    syncLivePolicy()
    return `角色 ${request.roleKey} 现在可以调用「${request.name}」，本次会话立即生效。`
  }
  if (!request.content) throw new Error('该技能申请没有附带内容，无法写入')
  writeSkill(request.roleKey, request.name, request.content)
  return `技能「${request.name}」已写入 ${request.roleKey} 的技能目录，下一次派生生效。`
}
