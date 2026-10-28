import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt from node:crypto, so no native dependency. The cost follows OWASP's guidance for scrypt
// (32 MiB of memory, N=2^15, r=8, p=3). The parameters are stored with every hash, so they can be
// raised later and old hashes keep verifying.
const N = 2 ** 15
const R = 8
const P = 3
const KEY_LENGTH = 64
const MAX_MEMORY = 128 * 1024 * 1024
/** The hash of a stored password can't ask for more work than this, whatever a corrupted record says. */
const MAX_N = 2 ** 17

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

const derive = (password: string, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) => {
    // NFKC so the same visible password typed on two keyboards or platforms is the same password.
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key),
    )
  })

/** `scrypt$N$r$p$salt$hash`, with salt and hash in base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const params = [Number(n), Number(r), Number(p)]
  if (!params.every(Number.isInteger) || params[0] > MAX_N) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), params[0], params[1], params[2])
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

let dummyHash: Promise<string> | undefined

/**
 * Checks a password against a throwaway hash. Signing in with a username that doesn't exist does
 * this, so it takes as long as a wrong password and response time doesn't reveal which usernames exist.
 */
export function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(12).toString('base64'))
  return dummyHash.then((hash) => verifyPassword(password, hash)).then(() => false as const)
}

export type PasswordProblem = 'password_short' | 'password_long' | 'password_username'

/** What's wrong with a password someone is choosing, or `null`. Not used for passwords that already exist. */
export function checkNewPassword(password: string, username?: string): PasswordProblem | null {
  const length = [...password].length
  if (length < PASSWORD_MIN) return 'password_short'
  if (length > PASSWORD_MAX) return 'password_long'
  if (username && password.toLowerCase() === username.toLowerCase()) return 'password_username'
  return null
}
