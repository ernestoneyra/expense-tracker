import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, UNAUTHORIZED_EVENT, api } from '../lib/api.ts'
import { AUTH_ERRORS, AuthContext, type Auth, type AuthUser, type ProviderInfo } from './AuthContext.ts'
import {
  clearTokens,
  finishAuthorization,
  maybeSignedIn,
  onSignedOutElsewhere,
  revokeRefreshToken,
  startAuthorization,
} from './tokens.ts'

const DEMO_KEY = 'expenser.demo'

interface SessionResponse {
  user: AuthUser | null
  providers: ProviderInfo[]
  demo: boolean
}

function readDemoChoice() {
  try {
    return localStorage.getItem(DEMO_KEY) === '1'
  } catch {
    return false
  }
}

function saveDemoChoice(on: boolean) {
  try {
    if (on) localStorage.setItem(DEMO_KEY, '1')
    else localStorage.removeItem(DEMO_KEY)
  } catch {
    // Without storage the choice only lasts until the page is reloaded.
  }
}

/** A Google / GitHub sign-in that failed comes back to `/?auth_error=…`; read it once and tidy the address. */
function takeSocialError(): string | undefined {
  const params = new URLSearchParams(location.search)
  const code = params.get('auth_error')
  if (params.has('auth_error')) {
    params.delete('auth_error')
    const query = params.toString()
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash)
  }
  return code && code in AUTH_ERRORS ? code : undefined
}

async function currentUser(): Promise<AuthUser | null> {
  try {
    return (await api<{ user: AuthUser }>('/auth/me')).user
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

interface Boot {
  session: SessionResponse
  user: AuthUser | null
  oauthError?: string
}

/**
 * Works out who is signed in when the app starts, in this order:
 *  1. Back from the authorization server with a code: trade it for tokens.
 *  2. Signed in on an earlier visit: renew the access token with the refresh cookie.
 *  3. No tokens but a sign-in cookie at the server (signed in in another tab, or just came back from
 *     Google / GitHub): ask the server for tokens, which leaves the page and returns with a code (1).
 *  4. Nothing: show the sign-in form.
 */
async function bootstrap(): Promise<Boot> {
  const session = await api<SessionResponse>('/auth/session')
  let oauthError = takeSocialError()

  const returned = await finishAuthorization()
  // `login_required` is the server saying nobody is signed in: not an error to show.
  const failed = returned.status === 'error'
  if (failed && returned.error !== 'login_required') {
    oauthError = returned.error === 'access_denied' ? 'oauth_denied' : 'oauth_failed'
  }

  const user = returned.status === 'done' || maybeSignedIn() ? await currentUser() : null
  // Only if the attempt above didn't just fail, or a refusal would be asked again, forever.
  if (!user && session.user && !failed) await startAuthorization()
  return { session, user, oauthError }
}

// Starting twice (React runs effects twice in development) would use the one-time code twice.
let booting: Promise<Boot> | undefined
const boot = () => (booting ??= bootstrap())

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Boot>()
  const [error, setError] = useState<string>()
  const [anonymous, setAnonymous] = useState(readDemoChoice)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let current = true
    boot().then(
      (result) => {
        if (!current) return
        setState(result)
        setError(undefined)
      },
      (err: Error) => {
        booting = undefined
        if (current) setError(err.message)
      },
    )
    return () => {
      current = false
    }
  }, [tick])

  const signedIn = useRef(false)
  useEffect(() => {
    signedIn.current = Boolean(state?.user)
  }, [state?.user])

  const signedOut = useCallback((expired: boolean) => {
    if (!signedIn.current) return
    signedIn.current = false
    clearTokens()
    setSessionExpired(expired)
    setState((current) => current && { ...current, user: null })
  }, [])

  // The server stopped accepting the tokens (the sign-in was ended, from here or from another device),
  // or another tab signed out.
  useEffect(() => {
    const onUnauthorized = () => signedOut(true)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    const stop = onSignedOutElsewhere(() => signedOut(false))
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
      stop()
    }
  }, [signedOut])

  // Checks the password and leaves a sign-in cookie, then asks the authorization server for tokens.
  // That navigates away, so these only come back with an error.
  const enter = useCallback(async (path: string, username: string, password: string, remember: boolean) => {
    await api(path, { method: 'POST', body: JSON.stringify({ username, password, remember }) })
    setSessionExpired(false)
    saveDemoChoice(false)
    await startAuthorization()
  }, [])

  const signIn = useCallback((u: string, p: string, r: boolean) => enter('/auth/login', u, p, r), [enter])
  const register = useCallback((u: string, p: string, r: boolean) => enter('/auth/register', u, p, r), [enter])

  const signOut = useCallback(async () => {
    // Leaving the anonymous demo has nothing to tell the server.
    if (state?.user) {
      signedIn.current = false
      // In this order: the second call drops the cookie the first one needs to know which sign-in to revoke.
      await revokeRefreshToken()
      await api('/auth/logout', { method: 'POST' }).catch(() => {})
    }
    clearTokens()
    saveDemoChoice(false)
    setAnonymous(false)
    setSessionExpired(false)
    // The next person to sign in starts at the dashboard, not on the page the last one left open.
    history.replaceState(null, '', location.pathname + location.search)
    setState((current) => current && { ...current, user: null })
  }, [state?.user])

  const startDemo = useCallback(() => {
    saveDemoChoice(true)
    setAnonymous(true)
  }, [])

  const reload = useCallback(() => {
    booting = undefined
    setTick((n) => n + 1)
  }, [])

  const value = useMemo<Auth>(
    () => ({
      status: state ? 'ready' : error ? 'failed' : 'loading',
      error,
      user: state?.user ?? null,
      providers: state?.session.providers ?? [],
      demoAvailable: state?.session.demo ?? false,
      // The anonymous demo only exists on a demo server; a stale choice from before is ignored.
      anonymous: anonymous && (state?.session.demo ?? false) && !state?.user,
      sessionExpired,
      oauthError: state?.oauthError,
      signIn,
      register,
      signOut,
      startDemo,
      reload,
    }),
    [state, error, anonymous, sessionExpired, signIn, register, signOut, startDemo, reload],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
