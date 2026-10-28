import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { authErrorKey, AUTH_ERRORS, useAuth } from '../auth/AuthContext.ts'
import { Button, LinkButton, SecondaryButton } from '../components/ui/Button.tsx'
import { Field, inputClass } from '../components/ui/fields.tsx'
import { LANGUAGES, isLanguage } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'

type Mode = 'signIn' | 'register'

const linkButtonClass =
  'inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-field px-3.5 font-semibold text-body no-underline hover:bg-hover hover:text-strong'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center justify-center gap-2.5 text-strong">
          <span
            className="grid size-9 place-items-center rounded-[10px] bg-accent text-lg font-bold text-accent-contrast"
            aria-hidden="true"
          >
            E
          </span>
          <span className="text-2xl font-bold tracking-tight">Expenser</span>
        </header>
        {children}
      </div>
    </div>
  )
}

/** Shown while the server is being asked who is signed in, or if it can't be reached. */
export function AuthStatus() {
  const { t } = usePreferences()
  const { status, error, reload } = useAuth()
  useEffect(() => {
    document.title = 'Expenser'
  }, [])
  return (
    <Shell>
      <main className="rounded-[14px] border border-line bg-surface p-5 text-center">
        {status === 'failed' ? (
          <div className="flex flex-col items-center gap-3" role="alert">
            <p className="text-strong">{t('auth.loadError', { error: error ?? '' })}</p>
            <Button onClick={reload}>{t('auth.retry')}</Button>
          </div>
        ) : (
          <p role="status">{t('common.loading')}</p>
        )}
      </main>
    </Shell>
  )
}

export function AuthPage() {
  const { t, language, setLanguage } = usePreferences()
  const auth = useAuth()

  const [mode, setMode] = useState<Mode>('signIn')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const heading = useRef<HTMLHeadingElement>(null)
  const problem = useRef<HTMLParagraphElement>(null)

  const registering = mode === 'register'
  const title = t(registering ? 'auth.registerTitle' : 'auth.signInTitle')

  // 2.4.2: the tab title says what this page is.
  useEffect(() => {
    document.title = `${title} – Expenser`
  }, [title])

  // 2.4.3: after switching between signing in and registering, focus goes to the new heading.
  const switched = useRef(false)
  useEffect(() => {
    if (!switched.current) {
      switched.current = true
      return
    }
    heading.current?.focus()
  }, [mode])

  // 3.3.1: a problem is announced and focus moves to it, so it's found without hunting for it.
  useEffect(() => {
    if (error) problem.current?.focus()
  }, [error])

  const switchMode = () => {
    setMode(registering ? 'signIn' : 'register')
    setError(undefined)
    setConfirm('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    if (registering && password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setBusy(true)
    try {
      await (registering ? auth.register : auth.signIn)(username.trim(), password, remember)
    } catch (err) {
      setError(t(authErrorKey(err)))
      setBusy(false)
    }
  }

  // Why the page was reached this way, when it isn't a plain visit.
  const notice = error
    ? undefined
    : auth.oauthError
      ? t(AUTH_ERRORS[auth.oauthError])
      : auth.sessionExpired
        ? t('auth.sessionExpired')
        : undefined

  return (
    <Shell>
      <main className="flex flex-col gap-5 rounded-[14px] border border-line bg-surface p-5 nav:p-6" aria-labelledby="auth-title">
        <header className="flex flex-col gap-1">
          <h1
            id="auth-title"
            ref={heading}
            tabIndex={-1}
            className="text-2xl leading-tight font-semibold tracking-tight text-strong outline-none"
          >
            {title}
          </h1>
          <p className="text-muted">{t(registering ? 'auth.registerSubtitle' : 'auth.signInSubtitle')}</p>
        </header>

        {(error || notice) && (
          <p
            ref={problem}
            tabIndex={-1}
            role={error ? 'alert' : 'status'}
            className="rounded-[10px] border border-danger px-3 py-2 font-medium text-danger"
          >
            {error ?? notice}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('auth.username')} hint={registering ? t('auth.usernameHint') : undefined}>
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              aria-invalid={error ? true : undefined}
            />
          </Field>
          <Field label={t('auth.password')} hint={registering ? t('auth.passwordHint') : undefined}>
            <input
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              type={show ? 'text' : 'password'}
              required
              maxLength={128}
              autoComplete={registering ? 'new-password' : 'current-password'}
              aria-invalid={error ? true : undefined}
            />
          </Field>
          {registering && (
            <Field label={t('auth.confirmPassword')}>
              <input
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                type={show ? 'text' : 'password'}
                required
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
          )}

          <div className="flex flex-col">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 accent-accent" checked={show} onChange={(e) => setShow(e.target.checked)} />
              {t('auth.showPassword')}
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" className="size-5 accent-accent" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              {t('auth.remember')}
            </label>
          </div>

          <Button type="submit" disabled={busy}>
            {busy ? t(registering ? 'auth.registering' : 'auth.signingIn') : t(registering ? 'auth.register' : 'auth.signIn')}
          </Button>
        </form>

        {auth.providers.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <p className="text-center">{t('auth.orContinueWith')}</p>
            {auth.providers.map((provider) => (
              // A full page navigation: the provider asks for consent and sends the browser back.
              <a key={provider.id} href={`/api/auth/oauth/${provider.id}/start`} className={linkButtonClass}>
                {t('auth.continueWith', { provider: provider.label })}
              </a>
            ))}
          </div>
        )}

        <p className="flex flex-wrap items-center justify-center gap-x-1 text-center">
          {t(registering ? 'auth.haveAccount' : 'auth.noAccount')}
          <LinkButton onClick={switchMode}>{t(registering ? 'auth.signIn' : 'auth.register')}</LinkButton>
        </p>

        {auth.demoAvailable && (
          <SecondaryButton onClick={auth.startDemo}>{t('auth.tryDemo')}</SecondaryButton>
        )}
      </main>

      <footer className="mx-auto w-full max-w-xs">
        <Field label={t('settings.language')}>
          <select
            value={language}
            onChange={(e) => isLanguage(e.target.value) && setLanguage(e.target.value)}
            className={inputClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </footer>
    </Shell>
  )
}
