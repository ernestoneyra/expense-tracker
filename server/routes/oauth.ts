import { createHash, randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { baseUrl } from '../auth/url.ts'
import { RateLimiter } from '../auth/rateLimit.ts'
import { authenticate } from '../auth/sessions.ts'
import { AuthCode } from '../models/AuthCode.ts'
import { RefreshToken } from '../models/RefreshToken.ts'
import { User } from '../models/User.ts'
import { SCOPES, clientOf, redirectUriOf, type Client } from '../oauth/clients.ts'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../oauth/refreshCookie.ts'
import { signingKey } from '../oauth/keys.ts'
import { hashToken, issueTokens, newToken, revokeFamily, type Issued } from '../oauth/tokens.ts'
import { statesMatch as safeEqual } from '../auth/oauth.ts'

// This app is its own OAuth 2.0 authorization server (RFC 6749), for its own web app:
//   GET  /authorize  the app sends the browser here; if the person is signed in, it's sent back with a code
//   POST /token      the app trades the code (and its PKCE secret) for an access token and a refresh token,
//                    and later a refresh token for a new pair
//   POST /revoke     sign-out: a refresh token is thrown away (RFC 7009)
// Sign-in itself (username and password, or Google / GitHub) lives in routes/auth.ts and leaves a
// session cookie, which is what /authorize looks at to know who is asking.

export const oauthRouter = Router()
export const discoveryRouter = Router()

oauthRouter.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
  next()
})

const MINUTE = 60_000
const CODE_LIFETIME_MS = MINUTE
const CODE_KEPT_MS = 10 * MINUTE
/**
 * Two tabs refreshing at once both present the same refresh token. The second is told "already used",
 * which looks exactly like a stolen token being replayed. Within this many seconds it is let through.
 */
const REUSE_LEEWAY_MS = 10_000
const HOUR = 60 * MINUTE

const failures = new RateLimiter(60, 15 * MINUTE)

const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

/** An error in the form RFC 6749 §5.2 asks for. */
class OAuthError extends Error {
  readonly status: number
  readonly code: string
  constructor(code: string, description: string, status = 400) {
    super(description)
    this.code = code
    this.status = status
  }
}

// ---------------------------------------------------------------------------------------------
// Authorization endpoint
// ---------------------------------------------------------------------------------------------

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/

oauthRouter.get('/authorize', async (req, res) => {
  const { client_id, redirect_uri, response_type, state, scope, code_challenge, code_challenge_method } = req.query
  const client = clientOf(client_id)
  // Until the client and its redirect address are known to be genuine, the person is told, not redirected:
  // sending them to an address from the request would turn this into an open redirector (§4.1.2.1).
  if (!client) return void res.status(400).type('text').send('Unknown client_id')
  const redirectUri = redirectUriOf(client, req)
  if (redirect_uri !== redirectUri) return void res.status(400).type('text').send('redirect_uri does not match')

  const back = (params: Record<string, string>) => {
    const url = new URL(redirectUri)
    // RFC 9207: say who answered, so a client that talks to several servers can tell.
    for (const [key, value] of Object.entries({ ...params, state: str(state) ?? '', iss: baseUrl(req) })) {
      if (value) url.searchParams.set(key, value)
    }
    res.redirect(url.toString())
  }
  const refuse = (error: string, description: string) => back({ error, error_description: description })

  if (response_type !== 'code') return refuse('unsupported_response_type', 'Only response_type=code is supported')
  if (!str(state)) return refuse('invalid_request', 'state is required')
  // PKCE is required of every client, and only the S256 method (RFC 7636; OAuth 2.1).
  if (typeof code_challenge !== 'string' || !CHALLENGE.test(code_challenge) || code_challenge_method !== 'S256') {
    return refuse('invalid_request', 'A PKCE code_challenge with code_challenge_method=S256 is required')
  }
  const scopes = (str(scope) ?? SCOPES[0]).split(' ').filter(Boolean)
  if (!scopes.every((s) => SCOPES.includes(s))) return refuse('invalid_scope', `Supported scopes: ${SCOPES.join(' ')}`)

  const session = await authenticate(req, res)
  // Nobody is signed in here. The app shows its sign-in form, and asks again once they are.
  if (!session) return refuse('login_required', 'The user is not signed in')

  // The one client is this app, so there is no consent screen to show: nobody is being asked to hand
  // their data to someone else. A third-party client would need one here.
  const code = newToken()
  const now = Date.now()
  await AuthCode.create({
    codeHash: hashToken(code),
    clientId: client.id,
    userId: session.user._id,
    redirectUri,
    codeChallenge: code_challenge,
    scope: scopes.join(' '),
    persistent: session.persistent,
    familyId: randomUUID(),
    validUntil: new Date(now + CODE_LIFETIME_MS),
    expiresAt: new Date(now + CODE_KEPT_MS),
  })
  back({ code })
})

// ---------------------------------------------------------------------------------------------
// Token endpoint
// ---------------------------------------------------------------------------------------------

const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/

async function userStillExists(id: unknown) {
  const user = await User.exists({ _id: id })
  if (!user) throw new OAuthError('invalid_grant', 'The account no longer exists')
}

async function authorizationCodeGrant(req: Request, body: Record<string, unknown>) {
  const client = clientOf(body.client_id)
  if (!client) throw new OAuthError('invalid_client', 'Unknown client_id', 401)
  const code = str(body.code)
  const verifier = str(body.code_verifier)
  if (!code || !verifier || !str(body.redirect_uri)) {
    throw new OAuthError('invalid_request', 'code, redirect_uri and code_verifier are required')
  }

  const codeHash = hashToken(code)
  // Marked used in the same step that finds it, so two requests with one code can't both succeed.
  const record = await AuthCode.findOneAndUpdate({ codeHash, usedAt: null }, { usedAt: new Date() })
  if (!record) {
    // A code that has been used and is presented again was copied. What it produced is revoked (§4.1.2).
    const used = await AuthCode.findOne({ codeHash })
    if (used) await revokeFamily(used.familyId)
    throw new OAuthError('invalid_grant', 'The code is not valid')
  }

  const challenge = createHash('sha256').update(verifier).digest('base64url')
  if (
    record.validUntil.getTime() <= Date.now() ||
    record.clientId !== client.id ||
    record.redirectUri !== body.redirect_uri ||
    !VERIFIER.test(verifier) ||
    !safeEqual(record.codeChallenge, challenge)
  ) {
    throw new OAuthError('invalid_grant', 'The code is not valid')
  }
  await userStillExists(record.userId)

  return issueTokens({
    userId: record.userId,
    clientId: client.id,
    scope: record.scope,
    familyId: record.familyId,
    persistent: record.persistent,
    familyCreatedAt: new Date(),
    issuer: baseUrl(req),
  })
}

async function refreshTokenGrant(req: Request, body: Record<string, unknown>) {
  const client = clientOf(body.client_id)
  if (!client) throw new OAuthError('invalid_client', 'Unknown client_id', 401)
  // A client that keeps its refresh token in a cookie sends nothing in the body: the browser attaches the
  // cookie, and a token in the body is ignored, so there is only one place it can come from.
  const token = client.refreshTokenInCookie ? readRefreshCookie(req) : str(body.refresh_token)
  if (!token) throw new OAuthError('invalid_grant', 'There is no refresh token')

  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) })
  const now = Date.now()
  if (!record || record.clientId !== client.id || record.expiresAt.getTime() <= now) {
    throw new OAuthError('invalid_grant', 'The refresh token is not valid')
  }

  if (record.rotatedAt) {
    // Already exchanged. Right after, it's most likely a second tab; much later, it's a copy.
    if (now - record.rotatedAt.getTime() > REUSE_LEEWAY_MS) {
      await revokeFamily(record.familyId)
      throw new OAuthError('invalid_grant', 'The refresh token is not valid')
    }
  } else {
    const retiredUntil = Math.min(record.expiresAt.getTime(), now + HOUR)
    // Retired in the step that finds it unused, so of two requests at once only one is "first".
    await RefreshToken.updateOne({ _id: record._id, rotatedAt: null }, { rotatedAt: new Date(now), expiresAt: new Date(retiredUntil) })
  }

  try {
    await userStillExists(record.userId)
  } catch (err) {
    await revokeFamily(record.familyId)
    throw err
  }
  return issueTokens({
    userId: record.userId,
    clientId: client.id,
    scope: record.scope,
    familyId: record.familyId,
    persistent: record.persistent,
    familyCreatedAt: record.familyCreatedAt,
    issuer: baseUrl(req),
  })
}

function sendError(res: Response, err: unknown) {
  if (err instanceof OAuthError) {
    if (err.status === 401) res.set('WWW-Authenticate', 'Basic realm="expenser"')
    return void res.status(err.status).json({ error: err.code, error_description: err.message })
  }
  throw err
}

oauthRouter.post('/token', async (req, res) => {
  const ip = req.ip ?? 'unknown'
  const wait = failures.retryAfter(ip)
  if (wait) {
    res.set('Retry-After', String(wait))
    return void res.status(429).json({ error: 'invalid_request', error_description: 'Too many failed requests. Try again later.' })
  }
  const body: Record<string, unknown> = typeof req.body === 'object' && req.body !== null ? req.body : {}
  try {
    const grant = body.grant_type
    if (grant !== 'authorization_code' && grant !== 'refresh_token') {
      throw new OAuthError('unsupported_grant_type', 'Use authorization_code or refresh_token')
    }
    const issued = await (grant === 'authorization_code' ? authorizationCodeGrant(req, body) : refreshTokenGrant(req, body))
    res.json(deliver(req, res, clientOf(body.client_id)!, issued))
  } catch (err) {
    failures.record(ip)
    // A refresh token the server won't take is no use any more: don't keep sending it.
    if (err instanceof OAuthError && err.code === 'invalid_grant' && clientOf(body.client_id)?.refreshTokenInCookie) {
      clearRefreshCookie(req, res)
    }
    sendError(res, err)
  }
})

/** The token response: the refresh token goes in the client's cookie, or for other clients in the body. */
function deliver(req: Request, res: Response, client: Client, issued: Issued) {
  if (client.refreshTokenInCookie) {
    setRefreshCookie(req, res, issued.refreshToken, issued.refreshMaxAge)
    return issued.body
  }
  return { ...issued.body, refresh_token: issued.refreshToken }
}

// Sign-out (RFC 7009). Only a refresh token can be revoked: an access token can't, and simply runs out.
// The answer is 200 whether or not the token was known, so it can't be used to test guesses.
oauthRouter.post('/revoke', async (req, res) => {
  const client = clientOf(req.body?.client_id)
  const token = client?.refreshTokenInCookie ? readRefreshCookie(req) : str(req.body?.token)
  if (token && client) {
    const record = await RefreshToken.findOne({ tokenHash: hashToken(token), clientId: client.id })
    if (record) await revokeFamily(record.familyId)
  }
  if (client?.refreshTokenInCookie) clearRefreshCookie(req, res)
  res.json({})
})

// ---------------------------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------------------------

// RFC 8414: how a client finds out where the endpoints are and what they support.
discoveryRouter.get('/.well-known/oauth-authorization-server', (req, res) => {
  const issuer = baseUrl(req)
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    jwks_uri: `${issuer}/api/oauth/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: SCOPES,
    authorization_response_iss_parameter_supported: true,
  })
})

oauthRouter.get('/jwks', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300').json({ keys: [signingKey().jwk] })
})
