import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { trusted, type Types } from 'mongoose'
import { Session } from '../models/Session.ts'
import { User, type UserDoc } from '../models/User.ts'
import { clearCookie, cookiesOf, setCookie } from './cookies.ts'

export const SESSION_COOKIE = 'expenser_session'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** "Keep me signed in": 30 days since the last visit. Otherwise a day, and the cookie ends with the browser. */
const PERSISTENT_TTL = 30 * DAY
const SHORT_TTL = DAY
/** However often it's used, a session ends this long after sign-in. */
const ABSOLUTE_TTL = 90 * DAY
/** Activity extends a session at most this often, so a busy page doesn't write on every request. */
const REFRESH_AFTER = HOUR

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Who a sign-in cookie belongs to. This is the authorization server's own record of a signed-in person. */
export interface Authenticated {
  user: UserDoc
  sessionId: Types.ObjectId
  /** Whether they asked to stay signed in. */
  persistent: boolean
}

function writeCookie(req: Request, res: Response, token: string, persistent: boolean, expiresAt: Date) {
  setCookie(req, res, SESSION_COOKIE, token, persistent ? { maxAge: (expiresAt.getTime() - Date.now()) / 1000 } : {})
}

/** Signs someone in. Always a fresh token, so a token set before sign-in (fixation) never becomes theirs. */
export async function startSession(req: Request, res: Response, userId: Types.ObjectId, persistent: boolean) {
  const previous = cookiesOf(req)[SESSION_COOKIE]
  if (previous) await Session.deleteOne({ tokenHash: hashToken(previous) })

  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (persistent ? PERSISTENT_TTL : SHORT_TTL))
  await Session.create({
    tokenHash: hashToken(token),
    userId,
    persistent,
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
    userAgent: req.get('user-agent')?.slice(0, 300),
  })
  writeCookie(req, res, token, persistent, expiresAt)
}

/** Who the request's cookie belongs to, or `null`. Extends the session while it's in use. */
export async function authenticate(req: Request, res: Response): Promise<Authenticated | null> {
  const token = cookiesOf(req)[SESSION_COOKIE]
  if (!token) return null

  const session = await Session.findOne({ tokenHash: hashToken(token) })
  const now = Date.now()
  if (!session || session.expiresAt.getTime() <= now || session.createdAt.getTime() + ABSOLUTE_TTL <= now) {
    if (session) await session.deleteOne()
    clearCookie(req, res, SESSION_COOKIE)
    return null
  }
  // The hash is excluded from queries by default; it's needed here to tell who has a password.
  const user = await User.findById(session.userId).select('+passwordHash')
  if (!user) {
    await session.deleteOne()
    clearCookie(req, res, SESSION_COOKIE)
    return null
  }

  if (now - session.lastUsedAt.getTime() > REFRESH_AFTER) {
    const ttl = session.persistent ? PERSISTENT_TTL : SHORT_TTL
    session.lastUsedAt = new Date(now)
    session.expiresAt = new Date(Math.min(now + ttl, session.createdAt.getTime() + ABSOLUTE_TTL))
    await session.save()
    writeCookie(req, res, token, session.persistent, session.expiresAt)
  }
  return { user, sessionId: session._id, persistent: session.persistent }
}

/** The id of the session the request's cookie belongs to, if it has a valid one. */
export async function currentSessionId(req: Request): Promise<Types.ObjectId | undefined> {
  const token = cookiesOf(req)[SESSION_COOKIE]
  if (!token) return undefined
  return (await Session.findOne({ tokenHash: hashToken(token) }).select('_id'))?._id
}

export async function endSession(req: Request, res: Response) {
  const token = cookiesOf(req)[SESSION_COOKIE]
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) })
  clearCookie(req, res, SESSION_COOKIE)
}

/** Ends every sign-in cookie of a user except the one making this request (`keep`, if it has one). */
export const endOtherSessions = (userId: Types.ObjectId, keep?: Types.ObjectId) =>
  Session.deleteMany(keep ? { userId, _id: trusted({ $ne: keep }) } : { userId })
