import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { DEMO_MODE, accountScope, sandboxMiddleware } from '../sandbox.ts'
import { User, type UserDoc } from '../models/User.ts'
import { verifyAccessToken } from '../oauth/jwt.ts'
import { baseUrl } from './url.ts'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Charts and progress bars set widths with style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

/** Account and data responses are about one person: no browser or proxy may keep a copy. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

/**
 * CSRF defence in depth, on top of SameSite=Lax cookies: a browser says where a request came from,
 * and a request that changes something must come from this site. Requests without those headers
 * (curl, a server) aren't a browser acting on someone's behalf, so they pass.
 */
export const sameOriginOnly: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const site = req.get('sec-fetch-site')
  const origin = req.get('origin')
  const ownHosts = new Set([req.get('host')])
  if (process.env.APP_URL) ownHosts.add(new URL(process.env.APP_URL).host)

  let sameOrigin = true
  if (site) sameOrigin = site === 'same-origin' || site === 'none'
  else if (origin) sameOrigin = ownHosts.has(safeHost(origin))
  if (!sameOrigin) {
    res.status(403).json({ error: 'Cross-site request refused', code: 'forbidden' })
    return
  }
  next()
}

const safeHost = (origin: string) => {
  try {
    return new URL(origin).host
  } catch {
    return ''
  }
}

/** Who an access token says is calling, once the user is confirmed to still exist. */
interface BearerAuth {
  user: UserDoc
  /** The sign-in this token belongs to (its refresh-token family). */
  familyId: string
}

const invalidToken = (res: Response) => {
  res.set('WWW-Authenticate', 'Bearer error="invalid_token"')
  res.status(401).json({ error: 'The access token is not valid or has expired', code: 'invalid_token' })
}

/**
 * Checks the `Authorization: Bearer` access token, if there is one, and leaves who it is in
 * `res.locals.auth`. A request with no token goes on as nobody (a later step decides if that is
 * allowed); one with a bad or expired token is turned away, so the app knows to refresh it.
 */
export const loadAuth: RequestHandler = async (req, res, next) => {
  if (res.locals.auth !== undefined) return next()
  const header = req.get('authorization')
  if (!header) {
    res.locals.auth = null
    return next()
  }
  const token = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header)?.[1]
  const claims = token && verifyAccessToken(token, baseUrl(req))
  // Looked up every time, so a deleted account's tokens stop working at once rather than when they expire.
  const user = claims && (await User.findById(claims.sub).select('+passwordHash'))
  if (!claims || !user) return invalidToken(res)
  res.locals.auth = { user, familyId: claims.fid } satisfies BearerAuth
  next()
}

export const authOf = (res: Response): BearerAuth | null => res.locals.auth ?? null

export function requireUser(_req: Request, res: Response, next: NextFunction) {
  if (!authOf(res)) {
    res.status(401).json({ error: 'Sign in to continue', code: 'unauthorized' })
    return
  }
  next()
}

/**
 * Everything below this answers for one person's data. Someone with a valid access token gets their
 * own account's data. In a hosted demo, someone without one can use a private demo sandbox instead.
 * Everyone else is turned away.
 */
export const requireScope: RequestHandler = async (req, res, next) => {
  if (res.locals.sandbox) return next()
  const auth = authOf(res)
  if (auth) {
    res.locals.sandbox = accountScope(auth.user._id)
    next()
    return
  }
  if (DEMO_MODE && req.get('x-sandbox-id')) {
    await sandboxMiddleware(req, res, next)
    return
  }
  res.status(401).json({ error: 'Sign in to continue', code: 'unauthorized' })
}

/** What the browser is told about a user (the password hash is only ever checked, never sent). */
export const publicUser = (user: UserDoc) => ({
  id: user.id as string,
  username: user.username,
  email: user.email ?? undefined,
  isGuest: user.isGuest,
  hasPassword: Boolean(user.passwordHash),
  providers: user.identities.map((i) => i.provider),
})
