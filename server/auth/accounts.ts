import { randomInt } from 'node:crypto'
import { Session } from '../models/Session.ts'
import { USERNAME_PATTERN, User, type UserDoc } from '../models/User.ts'
import { accountScope, provisionAccount, wipe } from '../sandbox.ts'

const RESERVED = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'help', 'staff', 'moderator', 'security',
  'expenser', 'api', 'null', 'undefined', 'anonymous',
])

export type UsernameProblem = 'username_invalid' | 'username_reserved'

/** A username as typed, if it's allowed; otherwise what's wrong with it. */
export function checkUsername(raw: unknown): { username: string } | { problem: UsernameProblem } {
  const username = typeof raw === 'string' ? raw.trim() : ''
  if (!USERNAME_PATTERN.test(username)) return { problem: 'username_invalid' }
  if (RESERVED.has(username.toLowerCase())) return { problem: 'username_reserved' }
  return { username }
}

export class UsernameTaken extends Error {}

const isDuplicateKey = (err: unknown): err is { code: 11000; keyPattern?: Record<string, unknown> } =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000

interface NewUser {
  username: string
  passwordHash?: string
  email?: string
  identity?: { provider: string; subject: string }
  isGuest?: boolean
}

/** Creates the account and its starting data. Throws UsernameTaken if the name is in use. */
export async function createUser({ username, passwordHash, email, identity, isGuest = false }: NewUser): Promise<UserDoc> {
  let user: UserDoc
  try {
    user = await User.create({
      username,
      usernameKey: username.toLowerCase(),
      passwordHash,
      email,
      identities: identity ? [identity] : [],
      isGuest,
    })
  } catch (err) {
    if (isDuplicateKey(err) && err.keyPattern && 'usernameKey' in err.keyPattern) throw new UsernameTaken()
    throw err
  }
  try {
    await provisionAccount(accountScope(user._id), isGuest)
  } catch (err) {
    // An account without its starting data would be half made; better that sign-up fails and can be retried.
    await wipe(accountScope(user._id))
    await user.deleteOne()
    throw err
  }
  return user
}

/** A free username close to what the provider suggested, for someone signing up with Google or GitHub. */
export async function createOAuthUser(hint: string, rest: Omit<NewUser, 'username'>): Promise<UserDoc> {
  let base = hint.toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 22)
  if (base.length < 3) base = `user${base}`
  if (RESERVED.has(base)) base = `${base}-user`
  for (let attempt = 0; attempt < 8; attempt++) {
    const username = attempt === 0 ? base : `${base}${randomInt(1000, 100_000)}`
    try {
      return await createUser({ ...rest, username })
    } catch (err) {
      if (!(err instanceof UsernameTaken)) throw err
    }
  }
  throw new Error('Could not find a free username')
}

/** Removes the account, every session and all of its data. */
export async function deleteAccount(user: UserDoc) {
  // Data and sessions first: if this stops half-way, the person can still sign in and try again.
  await wipe(accountScope(user._id))
  await Session.deleteMany({ userId: user._id })
  await user.deleteOne()
}
