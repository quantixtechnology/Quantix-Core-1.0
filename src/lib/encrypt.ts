// AES-256-CBC encryption for payment gateway credentials.
// Set CREDENTIAL_ENCRYPT_KEY env var to a 64-hex-char (32-byte) secret.
// Falls back to a dev-only default — DO NOT use the default in production.

import crypto from 'crypto'

const ALGO = 'aes-256-cbc'
const IV_LEN = 16

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPT_KEY
  if (raw) {
    if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
      return Buffer.from(raw, 'hex')
    }
    // Accept any string — derive 32 bytes via SHA-256
    return crypto.createHash('sha256').update(raw).digest()
  }
  // Dev-only fallback — deterministic, not secure
  return crypto.createHash('sha256').update('quantix-dev-credential-key-do-not-use-in-production').digest()
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${enc.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  try {
    const [ivHex, encHex] = ciphertext.split(':')
    if (!ivHex || !encHex) return ''
    const key     = getKey()
    const iv      = Buffer.from(ivHex, 'hex')
    const enc     = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}
