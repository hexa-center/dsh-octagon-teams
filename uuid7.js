/** RFC 9562 UUID version 7: 48-bit Unix millisecond timestamp, then random. */
import { randomBytes } from 'node:crypto'

/**
 * Generate one UUIDv7 string.
 * @returns {string} lowercase 8-4-4-4-12 UUIDv7.
 */
export function uuidv7() {
  const bytes = randomBytes(16)
  const ms = BigInt(Date.now())
  bytes[0] = Number((ms >> 40n) & 0xffn)
  bytes[1] = Number((ms >> 32n) & 0xffn)
  bytes[2] = Number((ms >> 24n) & 0xffn)
  bytes[3] = Number((ms >> 16n) & 0xffn)
  bytes[4] = Number((ms >> 8n) & 0xffn)
  bytes[5] = Number(ms & 0xffn)
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Agent preset id for one team role: `octagon-` plus a UUIDv7.
 * @param {string} uuid - UUIDv7 string.
 * @returns {string} preset id.
 */
export function presetId(uuid) {
  return `octagon-${uuid}`
}
