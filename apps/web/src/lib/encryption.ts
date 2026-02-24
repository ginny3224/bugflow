/**
 * BugFlow – Encryption helpers for integration credentials.
 *
 * AES-256-GCM authenticated encryption.
 * Key: 32-byte hex string stored in ENCRYPTION_KEY env var.
 * Wire format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV is recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${key.length} bytes.`
    )
  }
  return key
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param text  Plaintext string to encrypt.
 * @returns     Encoded string in the format `iv:authTag:ciphertext` (all hex).
 */
export function encrypt(text: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

/**
 * Decrypt a ciphertext produced by {@link encrypt}.
 *
 * @param encryptedText  Encoded string in the format `iv:authTag:ciphertext` (all hex).
 * @returns              Decrypted plaintext string.
 */
export function decrypt(encryptedText: string): string {
  const key = getKey()
  const parts = encryptedText.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected iv:authTag:ciphertext')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string]

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`)
  }
  if (authTag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH}, got ${authTag.length}`)
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
