import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto'
import { SigningKey } from '../models/SigningKey.ts'

// Access tokens are signed with Ed25519 (JWS alg "EdDSA", RFC 8037). The public half is published at
// the JWKS endpoint, so anything that needs to check a token can do so without being able to make one.

interface Key {
  kid: string
  privateKey: KeyObject
  publicKey: KeyObject
  /** The public key as the JWKS endpoint serves it. */
  jwk: Record<string, unknown>
}

let current: Key | undefined

export function keyFromPem(pem: string): Key {
  const privateKey = createPrivateKey(pem)
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('The signing key must be an Ed25519 private key (PKCS#8 PEM)')
  const publicKey = createPublicKey(privateKey)
  const kid = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('base64url').slice(0, 16)
  return { kid, privateKey, publicKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'EdDSA' } }
}

export function newPem() {
  return generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
}

/** Sets the key directly; for tests. */
export function setSigningKey(key: Key) {
  current = key
}

export function signingKey(): Key {
  if (!current) throw new Error('The signing key has not been loaded')
  return current
}

/** Loads the signing key: from OAUTH_SIGNING_KEY, else from the database, creating it the first time. */
export async function initSigningKey() {
  const fromEnv = process.env.OAUTH_SIGNING_KEY
  if (fromEnv) {
    // An environment variable holds a PEM on one line with \n written out.
    current = keyFromPem(fromEnv.replaceAll('\\n', '\n'))
    return
  }
  // An atomic upsert: if two servers start together, both end up with whichever key was stored first.
  const stored = await SigningKey.findOneAndUpdate(
    { _id: 'current' },
    { $setOnInsert: { privateKeyPem: newPem(), createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  )
  current = keyFromPem(stored.privateKeyPem)
  if (process.env.NODE_ENV === 'production') {
    console.warn('OAUTH_SIGNING_KEY is not set, so the token signing key is kept in the database. Set it to keep the key out of backups of the database.')
  }
}
