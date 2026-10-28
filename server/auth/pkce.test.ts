import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { challengeFor, randomString, sha256 } from '../../src/auth/pkce.ts'

test('the hand-written SHA-256 (for pages without crypto.subtle) matches the real one', () => {
  // Lengths around the 55 / 56 / 64 byte boundaries, where the padding changes shape.
  for (const length of [0, 1, 3, 43, 55, 56, 63, 64, 65, 119, 128, 300]) {
    const data = randomBytes(length)
    assert.deepEqual(Buffer.from(sha256(data)), createHash('sha256').update(data).digest(), `${length} bytes`)
  }
  assert.equal(Buffer.from(sha256(new TextEncoder().encode('abc'))).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('the code challenge is the RFC 7636 appendix B example', async () => {
  assert.equal(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
})

test('random strings are url-safe, unpadded, and long enough for a verifier', () => {
  const verifier = randomString(32)
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(verifier, randomString(32))
})
