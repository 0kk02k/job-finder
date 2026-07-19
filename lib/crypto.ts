// Symmetric encryption for stored platform credentials (AES-256-GCM).
// Key is derived from AUTH_SECRET via scrypt — no extra secret to manage.

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'

const KEY_SALT = 'job-finder-credentials'
const IV_LENGTH = 12 // recommended for GCM
const AUTH_TAG_LENGTH = 16

/**
 * Derive the 256-bit encryption key from AUTH_SECRET.
 * Throws if AUTH_SECRET is not configured.
 */
function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET ist nicht gesetzt — Zugangsdaten können nicht verschlüsselt werden.')
  }
  return scryptSync(secret, KEY_SALT, 32)
}

/**
 * Encrypt a plaintext string.
 * Returns base64 of `iv || authTag || ciphertext` as a single string.
 */
export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv, { authTagLength: AUTH_TAG_LENGTH })
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypt a payload produced by {@link encrypt}.
 * Throws a descriptive error for corrupt data or legacy plaintext records.
 */
export function decrypt(payload: string): string {
  let data: Buffer
  try {
    data = Buffer.from(payload, 'base64')
  } catch {
    throw new Error('Gespeicherte Zugangsdaten sind ungültig (kein Base64).')
  }
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Gespeicherte Zugangsdaten sind ungültig oder im alten Klartext-Format.')
  }
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  try {
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Gespeicherte Zugangsdaten konnten nicht entschlüsselt werden (falscher Schlüssel oder beschädigte Daten).')
  }
}
