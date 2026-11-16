/**
 * Cross-scope bookkeeping for agents this team spawned.
 *
 * Every agent of the team mounts the same preset, so a role's child mounts the
 * same copy of `team-runtime.js` as its parent. Node keeps one module instance
 * per process, so this Set is the only shared state the guard needs: the lead's
 * `write`/`edit`/`apply_patch` calls are refused while a spawned role's calls
 * pass. Ids are SessionIds of the children we started.
 */

/** @type {Map<string, string>} child session id → role key */
const workers = new Map()

/**
 * Record one spawned role so its write tools pass the guard.
 * @param {string} id - child session id.
 * @param {string} role - role key.
 */
export function markWorker(id, role) {
  workers.set(String(id), role)
}

/**
 * @param {unknown} id - session id.
 * @returns {boolean} whether this agent was spawned as a team role.
 */
export function isWorker(id) {
  return workers.has(String(id))
}

/**
 * @param {unknown} id - session id.
 * @returns {string | undefined} the role key behind that worker.
 */
export function workerRole(id) {
  return workers.get(String(id))
}
