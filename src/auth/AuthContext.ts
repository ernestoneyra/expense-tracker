import { createContext, useContext } from 'react'
import type { MessageKey } from '../i18n/config.ts'
import { ApiError } from '../lib/api.ts'

export interface AuthUser {
  id: string
  username: string
  email?: string
  /** One of the shared demo accounts: it can't be deleted or have its password changed. */
  isGuest: boolean
  /** False for accounts that only sign in with Google or GitHub. */
  hasPassword: boolean
  providers: string[]
}

export interface ProviderInfo {
  id: string
  label: string
}

export interface Auth {
  /** `loading` until the server has said whether anyone is signed in. */
  status: 'loading' | 'ready' | 'failed'
  error?: string
  user: AuthUser | null
  /** Google / GitHub sign-in, for the providers the server has credentials for. */
  providers: ProviderInfo[]
  /** The server is a hosted demo, where visitors may try the app without an account. */
  demoAvailable: boolean
  /** Using the demo without an account. */
  anonymous: boolean
  /** The person was signed in and the server no longer agrees. */
  sessionExpired: boolean
  /** Why a Google / GitHub sign-in sent them back unsuccessful (a key of AUTH_ERRORS), if it did. */
  oauthError?: string
  signIn: (username: string, password: string, remember: boolean) => Promise<void>
  register: (username: string, password: string, remember: boolean) => Promise<void>
  signOut: () => Promise<void>
  startDemo: () => void
  /** Asks the server again who is signed in. */
  reload: () => void
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

/** The server's reason codes, and the message that tells a person what to do about each. */
export const AUTH_ERRORS: Record<string, MessageKey> = {
  invalid_credentials: 'auth.error.invalid_credentials',
  username_taken: 'auth.error.username_taken',
  username_invalid: 'auth.error.username_invalid',
  username_reserved: 'auth.error.username_reserved',
  password_short: 'auth.error.password_short',
  password_long: 'auth.error.password_long',
  password_username: 'auth.error.password_username',
  too_many_attempts: 'auth.error.too_many_attempts',
  unauthorized: 'auth.error.unauthorized',
  guest_account: 'auth.error.guest_account',
  oauth_denied: 'auth.error.oauth_denied',
  oauth_failed: 'auth.error.oauth_failed',
  oauth_unavailable: 'auth.error.oauth_unavailable',
}

/** The key for a failed request's reason, or `auth.error.generic` when the server gave none we know. */
export function authErrorKey(err: unknown): MessageKey {
  return (err instanceof ApiError && err.code && AUTH_ERRORS[err.code]) || 'auth.error.generic'
}
