import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_BYTES = 16
const KEY_BYTES = 64
const PREFIX = 'scrypt$'

/** One-way password hash using Node scrypt. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES)
  const key = scryptSync(plain, salt, KEY_BYTES)
  return `${PREFIX}${salt.toString('hex')}$${key.toString('hex')}`
}

/** Constant-time compare against stored scrypt$... string. */
export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored.startsWith(PREFIX)) return false
  const rest = stored.slice(PREFIX.length)
  const dollar = rest.indexOf('$')
  if (dollar < 1) return false
  const saltHex = rest.slice(0, dollar)
  const expectedHex = rest.slice(dollar + 1)
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(expectedHex)) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false
  const key = scryptSync(plain, salt, KEY_BYTES)
  if (key.length !== expected.length) return false
  return timingSafeEqual(key, expected)
}
