import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// "Sign in with Google / GitHub": OAuth 2.0 authorization code flow with PKCE (RFC 7636) and a
// `state` check against login CSRF. The code is exchanged on the server, with the client secret,
// so no token ever reaches the browser. A provider shows up on the sign-in page only when its
// client id and secret are set in the environment.

interface Profile {
  /** The provider's stable id for the account (never the email or the login name, which can change). */
  subject: string
  name?: string
  /** Only set when the provider says it has verified it. */
  email?: string
  /** What to base the new account's username on. */
  usernameHint: string
}

interface Provider {
  id: 'google' | 'github'
  label: string
  authorizeUrl: string
  tokenUrl: string
  scope: string
  clientId: string
  clientSecret: string
  extraParams?: Record<string, string>
  fetchProfile: (accessToken: string) => Promise<Profile>
}

const TIMEOUT_MS = 10_000

async function getJson(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json', 'user-agent': 'expenser' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}

const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

async function googleProfile(accessToken: string): Promise<Profile> {
  const info = (await getJson('https://openidconnect.googleapis.com/v1/userinfo', accessToken)) as Record<string, unknown>
  const subject = str(info.sub)
  if (!subject) throw new Error('Google sent no account id')
  const email = info.email_verified === true ? str(info.email) : undefined
  return { subject, name: str(info.name), email, usernameHint: email?.split('@')[0] ?? str(info.given_name) ?? 'user' }
}

async function githubProfile(accessToken: string): Promise<Profile> {
  const user = (await getJson('https://api.github.com/user', accessToken)) as Record<string, unknown>
  if (typeof user.id !== 'number') throw new Error('GitHub sent no account id')
  const emails = (await getJson('https://api.github.com/user/emails', accessToken)) as Record<string, unknown>[]
  const primary = Array.isArray(emails) ? emails.find((e) => e.primary === true && e.verified === true) : undefined
  return {
    subject: String(user.id),
    name: str(user.name) ?? str(user.login),
    email: str(primary?.email),
    usernameHint: str(user.login) ?? 'user',
  }
}

/** The providers whose credentials are configured. Read on every call so tests and restarts see the environment. */
export function configuredProviders(): Provider[] {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env
  const list: Provider[] = []
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    list.push({
      id: 'google',
      label: 'Google',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      extraParams: { prompt: 'select_account' },
      fetchProfile: googleProfile,
    })
  }
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    list.push({
      id: 'github',
      label: 'GitHub',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scope: 'read:user user:email',
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      fetchProfile: githubProfile,
    })
  }
  return list
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url')

/** What must survive the round trip to the provider and back; kept in a short-lived HttpOnly cookie. */
interface Transaction {
  provider: string
  state: string
  verifier: string
}

export function newTransaction(provider: string): Transaction {
  return { provider, state: randomBytes(24).toString('base64url'), verifier: randomBytes(32).toString('base64url') }
}

export const encodeTransaction = (tx: Transaction) => Buffer.from(JSON.stringify(tx)).toString('base64url')

export function decodeTransaction(value: string | undefined): Transaction | null {
  if (!value) return null
  try {
    const tx = JSON.parse(Buffer.from(value, 'base64url').toString()) as Partial<Transaction>
    return typeof tx.provider === 'string' && typeof tx.state === 'string' && typeof tx.verifier === 'string'
      ? { provider: tx.provider, state: tx.state, verifier: tx.verifier }
      : null
  } catch {
    return null
  }
}

export function statesMatch(a: string, b: string | undefined) {
  if (!b) return false
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function authorizeUrl(provider: Provider, tx: Transaction, redirectUri: string) {
  const url = new URL(provider.authorizeUrl)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    scope: provider.scope,
    state: tx.state,
    code_challenge: sha256(tx.verifier),
    code_challenge_method: 'S256',
    ...provider.extraParams,
  }).toString()
  return url.toString()
}

/** Trades the one-time code for an access token. */
export async function exchangeCode(provider: Provider, code: string, verifier: string, redirectUri: string) {
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json', 'user-agent': 'expenser' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  // GitHub answers 200 with an `error` field when the code is wrong.
  if (!res.ok || !body || typeof body.access_token !== 'string') {
    throw new Error(`${new URL(provider.tokenUrl).host} refused the code: ${str(body?.error) ?? res.status}`)
  }
  return body.access_token
}

/** The PKCE challenge for a verifier; exported for tests. */
export const challengeFor = sha256
