/**
 * Capability requests: a role asks the lead for a tool or skill it was not
 * given, the lead (or the user, from the configuration page) decides.
 *
 * Requests live beside the rest of the profile state
 * (`<profile>/octagon-teams/requests.json`) so the audit trail survives a
 * restart. Only the newest {@link LIMIT} entries are kept.
 *
 * @module requests
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { teamDir } from './state.js'

const LIMIT = 200

/** @returns {string} absolute path of the request log. */
function file() {
  return join(teamDir(), 'requests.json')
}

/** @returns {Array<object>} stored requests, oldest first. */
export function loadRequests() {
  try {
    const parsed = JSON.parse(readFileSync(file(), 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** @param {Array<object>} list - requests to persist. */
function save(list) {
  mkdirSync(teamDir(), { recursive: true })
  writeFileSync(file(), `${JSON.stringify(list.slice(-LIMIT), null, 2)}\n`)
}

/**
 * Record a pending request.
 * @param {{roleKey:string, kind:'tool'|'skill', name:string, reason?:string, content?:string, requester?:string}} input
 * @returns {object} the stored request.
 */
export function recordRequest(input) {
  const list = loadRequests()
  const entry = {
    id: `cap-${randomUUID().slice(0, 8)}`,
    roleKey: input.roleKey,
    kind: input.kind,
    name: input.name,
    reason: input.reason ?? '',
    content: input.content ?? '',
    requester: input.requester ?? '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    note: '',
  }
  list.push(entry)
  save(list)
  return entry
}

/**
 * @returns {{pending: object[], recent: object[]}} newest first in each bucket.
 */
export function listRequests() {
  const all = loadRequests()
  return {
    pending: all.filter((request) => request.status === 'pending').reverse(),
    recent: all.filter((request) => request.status !== 'pending').reverse().slice(0, 20),
  }
}

/**
 * Decide one request.
 * @param {string} id - request id.
 * @param {{approve:boolean, by?:string, note?:string}} decision
 * @returns {object} updated request.
 */
export function decideRequest(id, decision) {
  const list = loadRequests()
  const request = list.find((entry) => entry.id === id)
  if (!request) throw new Error(`找不到能力申请 ${id}`)
  if (request.status !== 'pending') throw new Error(`该申请已处理：${request.status}`)
  request.status = decision.approve ? 'approved' : 'denied'
  request.decidedAt = new Date().toISOString()
  request.decidedBy = decision.by ?? 'lead'
  request.note = decision.note ?? ''
  save(list)
  return request
}

/**
 * Pending requests filed by one role.
 * @param {string} roleKey - role key.
 * @returns {object[]} pending requests.
 */
export function pendingFor(roleKey) {
  return loadRequests().filter((request) => request.status === 'pending' && request.roleKey === roleKey)
}
