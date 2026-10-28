import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUDIENCE, signAccessToken, verifyAccessToken } from './jwt.ts'
import { keyFromPem, newPem, setSigningKey, signingKey } from './keys.ts'

setSigningKey(keyFromPem(newPem()))

const ISSUER = 'https://expenser.example'
const claims = { iss: ISSUER, sub: 'user-1', scope: 'api', client_id: 'expenser-web', fid: 'family-1' }
const NOW = Date.UTC(2026, 0, 1)

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString())
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

test('a token verifies and carries its claims', () => {
  const token = signAccessToken(claims, 900, NOW)
  const verified = verifyAccessToken(token, ISSUER, NOW + 1000)
  assert.equal(verified?.sub, 'user-1')
  assert.equal(verified?.fid, 'family-1')
  assert.equal(verified?.aud, AUDIENCE)
  assert.equal(verified?.exp, NOW / 1000 + 900)
  assert.equal(decode(token.split('.')[0]).typ, 'at+jwt')
})

test('an expired token, or one for another issuer, is refused', () => {
  const token = signAccessToken(claims, 900, NOW)
  assert.ok(verifyAccessToken(token, ISSUER, NOW + 899_000))
  assert.equal(verifyAccessToken(token, ISSUER, NOW + 900_000), null)
  assert.equal(verifyAccessToken(token, 'https://elsewhere.example', NOW + 1000), null)
})

test('a changed payload or a signature from another key is refused', () => {
  const [header, payload, signature] = signAccessToken(claims, 900, NOW).split('.')
  const forged = encode({ ...decode(payload), sub: 'someone-else' })
  assert.equal(verifyAccessToken(`${header}.${forged}.${signature}`, ISSUER, NOW + 1000), null)

  const original = signingKey()
  setSigningKey({ ...keyFromPem(newPem()), kid: original.kid })
  assert.equal(verifyAccessToken(`${header}.${payload}.${signature}`, ISSUER, NOW + 1000), null)
  setSigningKey(original)
  assert.ok(verifyAccessToken(`${header}.${payload}.${signature}`, ISSUER, NOW + 1000))
})

test('the token does not get to choose its algorithm or key', () => {
  const [, payload] = signAccessToken(claims, 900, NOW).split('.')
  const kid = signingKey().kid
  // "alg: none", and an HMAC "signed" with the public key, are the classic ways round a naive check.
  assert.equal(verifyAccessToken(`${encode({ alg: 'none', typ: 'at+jwt', kid })}.${payload}.`, ISSUER, NOW + 1000), null)
  assert.equal(verifyAccessToken(`${encode({ alg: 'HS256', typ: 'at+jwt', kid })}.${payload}.AAAA`, ISSUER, NOW + 1000), null)
  assert.equal(verifyAccessToken(`${encode({ alg: 'EdDSA', typ: 'JWT', kid })}.${payload}.AAAA`, ISSUER, NOW + 1000), null)
  assert.equal(verifyAccessToken(`${encode({ alg: 'EdDSA', typ: 'at+jwt', kid: 'other' })}.${payload}.AAAA`, ISSUER, NOW + 1000), null)
})

test('garbage is refused without throwing', () => {
  for (const junk of ['', 'a', 'a.b', 'a.b.c', '...', 'not.a.jwt.at.all']) assert.equal(verifyAccessToken(junk, ISSUER), null)
})

test('the published key is a public Ed25519 JWK with the kid the tokens carry', () => {
  const { jwk, kid } = signingKey()
  assert.equal(jwk.kty, 'OKP')
  assert.equal(jwk.crv, 'Ed25519')
  assert.equal(jwk.kid, kid)
  assert.equal(jwk.d, undefined, 'the private part must never be published')
})
