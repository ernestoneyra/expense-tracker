import { Router, type Request, type Response } from 'express'
import { createOAuthUser, checkUsername, createUser, deleteAccount, UsernameTaken } from '../auth/accounts.ts'
import { clearCookie, cookiesOf, setCookie } from '../auth/cookies.ts'
import { authOf, noStore, publicUser, requireUser } from '../auth/middleware.ts'
import {
  authorizeUrl,
  configuredProviders,
  decodeTransaction,
  encodeTransaction,
  exchangeCode,
  newTransaction,
  statesMatch,
} from '../auth/oauth.ts'
import { checkNewPassword, hashPassword, verifyAgainstDummy, verifyPassword } from '../auth/password.ts'
import { RateLimiter } from '../auth/rateLimit.ts'
import { SESSION_COOKIE, endOtherSessions, endSession, startSession } from '../auth/sessions.ts'
import { User } from '../models/User.ts'
import { DEMO_MODE } from '../sandbox.ts'

export const authRouter = Router()
authRouter.use(noStore)

const MINUTE = 60_000
// Failed sign-ins are counted twice: per address (stops one machine trying many accounts) and per
// address and username (stops guessing one account). Not per username alone, which would let
// anyone lock a person out by failing on purpose.
const failuresByIp = new RateLimiter(30, 15 * MINUTE)
const failuresByAccount = new RateLimiter(8, 15 * MINUTE)
const registrations = new RateLimiter(10, 60 * MINUTE)
const passwordFailures = new RateLimiter(5, 15 * MINUTE)
const oauthStarts = new RateLimiter(30, 15 * MINUTE)

const TX_COOKIE = 'expenser_oauth'
const TX_PATH = '/api/auth/oauth'

type Body = Record<string, unknown>
const bodyOf = (req: Request): Body => (typeof req.body === 'object' && req.body !== null ? req.body : {})

function fail(res: Response, status: number, code: string, error: string, retryAfter?: number) {
  if (retryAfter) res.set('Retry-After', String(retryAfter))
  res.status(status).json({ error, code })
}

const tooMany = (res: Response, seconds: number) =>
  fail(res, 429, 'too_many_attempts', 'Too many attempts. Try again later.', seconds)

// ---------------------------------------------------------------------------------------------
// Who am I
// ---------------------------------------------------------------------------------------------

// Always 200: not being signed in is an answer, not an error. The sign-in page also learns here
// which providers are configured and whether anonymous demo sandboxes exist.
authRouter.get('/session', (_req, res) => {
  const auth = authOf(res)
  res.json({
    user: auth ? publicUser(auth.user) : null,
    providers: configuredProviders().map(({ id, label }) => ({ id, label })),
    demo: DEMO_MODE,
  })
})

// ---------------------------------------------------------------------------------------------
// Password accounts
// ---------------------------------------------------------------------------------------------

authRouter.post('/register', async (req, res) => {
  const ip = req.ip ?? 'unknown'
  const wait = registrations.retryAfter(ip)
  if (wait) return tooMany(res, wait)

  const { username: rawUsername, password } = bodyOf(req)
  const checked = checkUsername(rawUsername)
  if ('problem' in checked) return fail(res, 400, checked.problem, 'That username is not allowed')
  if (typeof password !== 'string') return fail(res, 400, 'password_short', 'Choose a password')
  const problem = checkNewPassword(password, checked.username)
  if (problem) return fail(res, 400, problem, 'That password is not allowed')

  registrations.record(ip)
  try {
    const user = await createUser({ username: checked.username, passwordHash: await hashPassword(password) })
    await startSession(req, res, user._id, Boolean(bodyOf(req).remember))
    res.status(201).json({ user: publicUser(user) })
  } catch (err) {
    if (err instanceof UsernameTaken) return fail(res, 409, 'username_taken', 'That username is already taken')
    throw err
  }
})

authRouter.post('/login', async (req, res) => {
  const ip = req.ip ?? 'unknown'
  const { username, password, remember } = bodyOf(req)
  const key = typeof username === 'string' ? username.trim().toLowerCase().slice(0, 64) : ''
  const accountKey = `${ip}|${key}`

  const wait = Math.max(failuresByIp.retryAfter(ip), failuresByAccount.retryAfter(accountKey))
  if (wait) return tooMany(res, wait)

  const user =
    key && typeof password === 'string' && password.length <= 1024
      ? await User.findOne({ usernameKey: key }).select('+passwordHash')
      : null
  const valid =
    typeof password === 'string' && password.length <= 1024
      ? user?.passwordHash
        ? await verifyPassword(password, user.passwordHash)
        : await verifyAgainstDummy(password)
      : false

  if (!user || !valid) {
    failuresByIp.record(ip)
    failuresByAccount.record(accountKey)
    // The same answer for a wrong password, an unknown username and an account that has no password.
    return fail(res, 401, 'invalid_credentials', 'Incorrect username or password')
  }

  failuresByAccount.clear(accountKey)
  user.lastLoginAt = new Date()
  await user.save()
  await startSession(req, res, user._id, remember === true)
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', async (req, res) => {
  await endSession(req, res)
  res.status(204).end()
})

// ---------------------------------------------------------------------------------------------
// Managing your own account
// ---------------------------------------------------------------------------------------------

authRouter.post('/logout-others', requireUser, async (_req, res) => {
  const { user, sessionId } = authOf(res)!
  await endOtherSessions(user._id, sessionId)
  res.status(204).end()
})

authRouter.post('/password', requireUser, async (req, res) => {
  const { user, sessionId } = authOf(res)!
  if (user.isGuest) return fail(res, 403, 'guest_account', 'The demo accounts keep their password')
  if (!user.passwordHash) return fail(res, 400, 'no_password', 'This account signs in with a provider')

  const key = `password:${user.id}`
  const wait = passwordFailures.retryAfter(key)
  if (wait) return tooMany(res, wait)

  const { currentPassword, newPassword } = bodyOf(req)
  if (typeof currentPassword !== 'string' || currentPassword.length > 1024 || !(await verifyPassword(currentPassword, user.passwordHash))) {
    passwordFailures.record(key)
    return fail(res, 403, 'invalid_credentials', 'The current password is not right')
  }
  const problem = typeof newPassword === 'string' ? checkNewPassword(newPassword, user.username) : 'password_short'
  if (problem) return fail(res, 400, problem, 'That password is not allowed')

  user.passwordHash = await hashPassword(newPassword as string)
  await user.save()
  // Whoever else had the old password, or a session open, is signed out; this browser stays in.
  await endOtherSessions(user._id, sessionId)
  res.status(204).end()
})

authRouter.delete('/account', requireUser, async (req, res) => {
  const { user } = authOf(res)!
  if (user.isGuest) return fail(res, 403, 'guest_account', 'The demo accounts can not be deleted')

  // Deleting is permanent, so it asks again: the password, or for provider-only accounts the username.
  const key = `password:${user.id}`
  const wait = passwordFailures.retryAfter(key)
  if (wait) return tooMany(res, wait)
  const { password, confirm } = bodyOf(req)
  const confirmed = user.passwordHash
    ? typeof password === 'string' && password.length <= 1024 && (await verifyPassword(password, user.passwordHash))
    : typeof confirm === 'string' && confirm.trim().toLowerCase() === user.usernameKey
  if (!confirmed) {
    passwordFailures.record(key)
    return fail(res, 403, 'invalid_credentials', 'That does not match')
  }

  await deleteAccount(user)
  clearCookie(req, res, SESSION_COOKIE)
  res.status(204).end()
})

// ---------------------------------------------------------------------------------------------
// Sign in with Google / GitHub
// ---------------------------------------------------------------------------------------------

/** Where this app is reached from; must match the redirect URI registered with the provider. */
function baseUrl(req: Request) {
  const configured = process.env.APP_URL?.replace(/\/+$/, '')
  return configured ?? `${req.protocol}://${req.get('host')}`
}

const redirectUri = (req: Request, provider: string) => `${baseUrl(req)}/api/auth/oauth/${provider}/callback`

/** Back to the app, with the reason if sign-in didn't work: the sign-in page shows it. */
function backToApp(req: Request, res: Response, error?: string) {
  clearCookie(req, res, TX_COOKIE, TX_PATH)
  res.redirect(`${baseUrl(req)}/${error ? `?auth_error=${error}` : ''}`)
}

authRouter.get('/oauth/:provider/start', (req, res) => {
  const provider = configuredProviders().find((p) => p.id === req.params.provider)
  if (!provider) return backToApp(req, res, 'oauth_unavailable')
  const ip = req.ip ?? 'unknown'
  const wait = oauthStarts.retryAfter(ip)
  if (wait) return backToApp(req, res, 'too_many_attempts')
  oauthStarts.record(ip)

  const tx = newTransaction(provider.id)
  setCookie(req, res, TX_COOKIE, encodeTransaction(tx), { maxAge: 10 * 60, path: TX_PATH })
  res.redirect(authorizeUrl(provider, tx, redirectUri(req, provider.id)))
})

authRouter.get('/oauth/:provider/callback', async (req, res) => {
  const provider = configuredProviders().find((p) => p.id === req.params.provider)
  if (!provider) return backToApp(req, res, 'oauth_unavailable')
  if (typeof req.query.error === 'string') return backToApp(req, res, 'oauth_denied')

  // The `state` the provider hands back must be the one this browser started with: otherwise
  // someone could be made to finish a sign-in they didn't begin.
  const tx = decodeTransaction(cookiesOf(req)[TX_COOKIE])
  const { code, state } = req.query
  if (!tx || tx.provider !== provider.id || typeof code !== 'string' || !statesMatch(tx.state, typeof state === 'string' ? state : undefined)) {
    return backToApp(req, res, 'oauth_failed')
  }

  try {
    const accessToken = await exchangeCode(provider, code, tx.verifier, redirectUri(req, provider.id))
    const profile = await provider.fetchProfile(accessToken)

    // Matched on the provider's account id only. Matching on email would let anyone who registers
    // with someone else's address take over that account.
    let user = await User.findOne({ identities: { $elemMatch: { provider: provider.id, subject: profile.subject } } })
    if (!user) {
      user = await createOAuthUser(profile.usernameHint, {
        email: profile.email,
        identity: { provider: provider.id, subject: profile.subject },
      })
    }
    user.lastLoginAt = new Date()
    await user.save()
    await startSession(req, res, user._id, true)
    backToApp(req, res)
  } catch (err) {
    console.error(`Sign-in with ${provider.label} failed:`, err instanceof Error ? err.message : err)
    backToApp(req, res, 'oauth_failed')
  }
})
