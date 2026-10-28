import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCookies } from './cookies.ts'
import { challengeFor, decodeTransaction, encodeTransaction, newTransaction, statesMatch } from './oauth.ts'
import { checkNewPassword, hashPassword, verifyAgainstDummy, verifyPassword } from './password.ts'
import { RateLimiter } from './rateLimit.ts'
import { checkUsername } from './accounts.ts'

test('a password verifies against its own hash and no other', async () => {
  const hash = await hashPassword('correct horse battery')
  assert.ok(hash.startsWith('scrypt$'))
  assert.equal(await verifyPassword('correct horse battery', hash), true)
  assert.equal(await verifyPassword('correct horse batterz', hash), false)
  // Two hashes of the same password differ (random salt).
  assert.notEqual(hash, await hashPassword('correct horse battery'))
})

test('the same visible password verifies however it was composed', async () => {
  const hash = await hashPassword('café-passphrase') // precomposed é
  assert.equal(await verifyPassword('café-passphrase', hash), true) // e + combining accent
})

test('malformed or hostile stored hashes are rejected, not run', async () => {
  assert.equal(await verifyPassword('x', ''), false)
  assert.equal(await verifyPassword('x', 'bcrypt$1$2$3$a$b'), false)
  assert.equal(await verifyPassword('x', `scrypt$${2 ** 30}$8$1$c2FsdA==$aGFzaA==`), false)
})

test('the dummy check always fails', async () => {
  assert.equal(await verifyAgainstDummy('password'), false)
})

test('new passwords: length and the username', () => {
  assert.equal(checkNewPassword('short'), 'password_short')
  assert.equal(checkNewPassword('x'.repeat(129)), 'password_long')
  assert.equal(checkNewPassword('Password123'), null)
  assert.equal(checkNewPassword('Alice-Smith-1', 'alice-smith-1'), 'password_username')
  assert.equal(checkNewPassword('a long enough phrase'), null)
  // Length counts characters, not UTF-16 units: eight emoji are eight characters.
  assert.equal(checkNewPassword('😀'.repeat(8)), null)
})

test('usernames', () => {
  assert.deepEqual(checkUsername('  guest1 '), { username: 'guest1' })
  assert.deepEqual(checkUsername('Ab.c-d_9'), { username: 'Ab.c-d_9' })
  for (const bad of ['ab', '-abc', 'a b c', 'x'.repeat(31), '', 42, null]) {
    assert.deepEqual(checkUsername(bad), { problem: 'username_invalid' }, String(bad))
  }
  assert.deepEqual(checkUsername('Admin'), { problem: 'username_reserved' })
})

test('cookies are parsed, the first of a repeated name wins, bad encoding is skipped', () => {
  assert.deepEqual(parseCookies('a=1; b=hello%20world; a=2; c=%E0%A4%A; d'), { a: '1', b: 'hello world' })
  assert.deepEqual(parseCookies(undefined), {})
})

test('rate limiter blocks after max, reports the wait, and forgets over time', () => {
  const limiter = new RateLimiter(3, 60_000)
  const t0 = 1_000_000
  assert.equal(limiter.retryAfter('k', t0), 0)
  for (let i = 0; i < 3; i++) limiter.record('k', t0 + i * 1000)
  assert.equal(limiter.retryAfter('k', t0 + 5000), 55)
  assert.equal(limiter.retryAfter('other', t0 + 5000), 0)
  assert.equal(limiter.retryAfter('k', t0 + 60_001), 0)
  limiter.record('k', t0 + 60_100)
  limiter.clear('k')
  assert.equal(limiter.retryAfter('k', t0 + 60_200), 0)
})

test('OAuth: PKCE challenge matches the RFC 7636 example, and the state cookie round-trips', () => {
  assert.equal(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')

  const tx = newTransaction('google')
  assert.deepEqual(decodeTransaction(encodeTransaction(tx)), tx)
  assert.equal(decodeTransaction('not-a-transaction'), null)
  assert.equal(decodeTransaction(undefined), null)
  assert.equal(statesMatch(tx.state, tx.state), true)
  assert.equal(statesMatch(tx.state, tx.state + 'x'), false)
  assert.equal(statesMatch(tx.state, undefined), false)
})
