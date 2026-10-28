import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { UNAUTHORIZED_EVENT, api } from '../lib/api.ts'
import { AUTH_ERRORS, AuthContext, type Auth, type AuthUser, type ProviderInfo } from './AuthContext.ts'

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
function takeOAuthError(): string | undefined {
  const params = new URLSearchParams(location.search)
  const code = params.get('auth_error')
  if (params.has('auth_error')) {
    params.delete('auth_error')
    const query = params.toString()
    history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash)
  }
  return code && code in AUTH_ERRORS ? code : undefined
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse>()
  const [error, setError] = useState<string>()
  const [anonymous, setAnonymous] = useState(readDemoChoice)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [oauthError] = useState(takeOAuthError)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    api<SessionResponse>('/auth/session', { signal: ctrl.signal }).then(
      (data) => {
        setSession(data)
        setError(undefined)
      },
      (err: Error) => {
        if (!ctrl.signal.aborted) setError(err.message)
      },
    )
    return () => ctrl.abort()
  }, [tick])

  const signedIn = useRef(false)
  useEffect(() => {
    signedIn.current = Boolean(session?.user)
  }, [session?.user])

  // The server stopped recognising the session (it ended, or was ended from another device).
  useEffect(() => {
    const onUnauthorized = () => {
      if (!signedIn.current) return
      signedIn.current = false
      setSessionExpired(true)
      setSession((current) => current && { ...current, user: null })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const enter = useCallback(async (path: string, username: string, password: string, remember: boolean) => {
    const { user } = await api<{ user: AuthUser }>(path, {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    })
    setSessionExpired(false)
    saveDemoChoice(false)
    setAnonymous(false)
    setSession((current) => current && { ...current, user })
  }, [])

  const signIn = useCallback((u: string, p: string, r: boolean) => enter('/auth/login', u, p, r), [enter])
  const register = useCallback((u: string, p: string, r: boolean) => enter('/auth/register', u, p, r), [enter])

  const signOut = useCallback(async () => {
    // Leaving the anonymous demo has nothing to tell the server.
    if (session?.user) await api('/auth/logout', { method: 'POST' }).catch(() => {})
    saveDemoChoice(false)
    setAnonymous(false)
    setSessionExpired(false)
    // The next person to sign in starts at the dashboard, not on the page the last one left open.
    history.replaceState(null, '', location.pathname + location.search)
    setSession((current) => current && { ...current, user: null })
  }, [session?.user])

  const startDemo = useCallback(() => {
    saveDemoChoice(true)
    setAnonymous(true)
  }, [])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  const value = useMemo<Auth>(
    () => ({
      status: session ? 'ready' : error ? 'failed' : 'loading',
      error,
      user: session?.user ?? null,
      providers: session?.providers ?? [],
      demoAvailable: session?.demo ?? false,
      // The anonymous demo only exists on a demo server; a stale choice from before is ignored.
      anonymous: anonymous && (session?.demo ?? false) && !session?.user,
      sessionExpired,
      oauthError,
      signIn,
      register,
      signOut,
      startDemo,
      reload,
    }),
    [session, error, anonymous, sessionExpired, oauthError, signIn, register, signOut, startDemo, reload],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
