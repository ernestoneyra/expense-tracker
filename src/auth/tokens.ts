import { challengeFor, randomString } from './pkce.ts'

// The app's side of OAuth 2.0 (authorization code flow with PKCE), talking to the server's own
// authorization server. Where the credentials live:
//   access token   in memory only. It lasts minutes, and a page reload gets a new one.
//   refresh token  not here at all. The server keeps it in an HttpOnly cookie that only the token
//                  endpoint receives, so no script on the page can read it, and a script injected
//                  into the page can't carry it off. The browser attaches it when `refresh()` posts to
//                  /token, and the server swaps it for a new one each time.
// All that is kept in storage is `SIGNED_IN_KEY`: a flag saying a refresh is worth trying. It is not a
// credential. Without it, a visitor who has never signed in would make a failing request on every load.

const CLIENT_ID = 'expenser-web'
const CALLBACK_PATH = '/auth/callback'
const SIGNED_IN_KEY = 'expenser.signed-in'
const PENDING_KEY = 'expenser.authorization'
/** Refresh a little early, so a request never leaves with a token that expires on the way. */
const EARLY_MS = 30_000

interface TokenResponse {
  access_token: string
  expires_in: number
}

let access: { token: string; expiresAt: number } | undefined

/** Whether this browser was signed in last time, i.e. whether asking the server for tokens could work. */
export function maybeSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1'
  } catch {
    return false
  }
}

function setSignedInFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1')
    else localStorage.removeItem(SIGNED_IN_KEY)
  } catch {
    // Storage unavailable: the flag only matters on the next page load, and there it just means no refresh is tried.
  }
}

function keep(tokens: TokenResponse) {
  access = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 }
  setSignedInFlag(true)
}

/** Forgets the sign-in in this browser. (The server is told by `revokeRefreshToken`.) */
export function clearTokens() {
  access = undefined
  setSignedInFlag(false)
}

/** Calls back when another tab signs out. */
export function onSignedOutElsewhere(callback: () => void) {
  const listener = (e: StorageEvent) => {
    if (e.key === SIGNED_IN_KEY && e.newValue === null) {
      access = undefined
      callback()
    }
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}

async function postToken(params: Record<string, string>): Promise<TokenResponse | { error: string }> {
  const res = await fetch('/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  })
  const body = await res.json().catch(() => null)
  return res.ok && typeof body?.access_token === 'string' ? body : { error: body?.error ?? 'server_error' }
}

let refreshing: Promise<boolean> | undefined

/**
 * Asks for a new access token, using the refresh cookie the browser holds. `false` if the server no
 * longer accepts it (the person is signed out); it throws if the server couldn't be reached, which is
 * no reason to sign anyone out. One at a time across tabs where the browser has Web Locks, since a
 * refresh token can only be used once.
 */
export function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const run = async () => {
      const result = await postToken({ grant_type: 'refresh_token' })
      if ('error' in result) {
        if (result.error !== 'invalid_grant') throw new Error('Could not renew the sign-in')
        clearTokens()
        return false
      }
      keep(result)
      return true
    }
    return navigator.locks ? navigator.locks.request('expenser-refresh', run) : run()
  })().finally(() => {
    refreshing = undefined
  })
  return refreshing
}

/** An access token that will still be good for the request about to be made, or `undefined` if signed out. */
export async function accessToken(): Promise<string | undefined> {
  if (access && access.expiresAt - Date.now() > EARLY_MS) return access.token
  if (maybeSignedIn()) await refresh()
  return access && access.expiresAt > Date.now() ? access.token : undefined
}

/** Signs out of this browser: the server revokes the refresh token and drops the cookie, then the rest is forgotten here. */
export async function revokeRefreshToken() {
  const was = maybeSignedIn()
  clearTokens()
  if (!was) return
  await fetch('/api/oauth/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID }),
  }).catch(() => {})
}

// ---------------------------------------------------------------------------------------------
// Getting the first tokens: send the browser to /authorize, and read the answer when it returns.
// ---------------------------------------------------------------------------------------------

const callbackUri = () => `${location.origin}${CALLBACK_PATH}`

/** Sends the browser to the authorization server. It comes back to the callback address with a code. Never returns. */
export async function startAuthorization(): Promise<never> {
  const state = randomString(16)
  const verifier = randomString(32)
  // The secret stays here, in this tab, while the browser is away. The page the person was on is kept
  // so they land back on it.
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier, hash: location.hash }))
  location.assign(
    `/api/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: callbackUri(),
      scope: 'api',
      state,
      code_challenge: await challengeFor(verifier),
      code_challenge_method: 'S256',
    })}`,
  )
  return new Promise<never>(() => {})
}

export type Authorization =
  | { status: 'none' }
  | { status: 'done' }
  /** `login_required` just means nobody is signed in to the server; anything else is a failure to tell the person about. */
  | { status: 'error'; error: string }

/** If the browser has just come back from /authorize, finishes the sign-in by trading the code for tokens. */
export async function finishAuthorization(): Promise<Authorization> {
  if (location.pathname !== CALLBACK_PATH) return { status: 'none' }
  const params = new URLSearchParams(location.search)
  let pending: { state: string; verifier: string; hash: string } | undefined
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') ?? undefined
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    pending = undefined
  }
  // A code can only be used once, so the address is cleaned up before anything else can reload it.
  history.replaceState(null, '', `/${pending?.hash ?? ''}`)

  const error = params.get('error')
  if (error) return { status: 'error', error }
  const code = params.get('code')
  // `state` ties this answer to the request this tab made: without the check, someone could send a
  // person a link that signs them in as someone else.
  if (!pending || !code || params.get('state') !== pending.state) return { status: 'error', error: 'state_mismatch' }

  const result = await postToken({ grant_type: 'authorization_code', code, redirect_uri: callbackUri(), code_verifier: pending.verifier })
  if ('error' in result) return { status: 'error', error: result.error }
  keep(result)
  return { status: 'done' }
}
