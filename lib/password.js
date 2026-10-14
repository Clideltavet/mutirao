import crypto from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(crypto.scrypt)

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = await scryptAsync(String(password), salt, 64)
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hashHex] = String(stored || '').split('$')
    if (scheme !== 'scrypt' || !salt || !hashHex) return false
    const derived = await scryptAsync(String(password), salt, 64)
    const actual = Buffer.from(derived)
    const expected = Buffer.from(hashHex, 'hex')
    if (actual.length !== expected.length) return false
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}
