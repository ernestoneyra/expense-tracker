import { useState, type FormEvent } from 'react'
import { authErrorKey, useAuth } from '../../auth/AuthContext.ts'
import { Button, DangerButton, SecondaryButton } from '../../components/ui/Button.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { Field, inputClass } from '../../components/ui/fields.tsx'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import { ApiError, api } from '../../lib/api.ts'

type Status = { ok: boolean; text: string }

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', github: 'GitHub' }

function StatusLine({ status }: { status?: Status }) {
  if (!status) return null
  return (
    <p className={`text-sm ${status.ok ? 'text-muted' : 'text-danger'}`} role={status.ok ? 'status' : 'alert'}>
      {status.text}
    </p>
  )
}

/** Who you are signed in as, and the things only you should be able to do to the account. */
export function AccountCard() {
  const { t } = usePreferences()
  const { user, signOut } = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<Status>()
  const [devicesStatus, setDevicesStatus] = useState<Status>()
  const [deleting, setDeleting] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<Status>()
  const [busy, setBusy] = useState(false)

  // Only people with an account see this; the anonymous demo has none.
  if (!user) return null

  // A wrong password has its own wording here, since there is no username to blame.
  const reason = (err: unknown) =>
    err instanceof ApiError && err.code === 'invalid_credentials' ? t('account.wrongPassword') : t(authErrorKey(err))

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setPasswordStatus(undefined)
    try {
      await api('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) })
      setCurrent('')
      setNext('')
      setPasswordStatus({ ok: true, text: t('account.passwordChanged') })
    } catch (err) {
      setPasswordStatus({ ok: false, text: t('account.passwordError', { error: reason(err) }) })
    } finally {
      setBusy(false)
    }
  }

  const signOutOthers = async () => {
    setBusy(true)
    setDevicesStatus(undefined)
    try {
      await api('/auth/logout-others', { method: 'POST' })
      setDevicesStatus({ ok: true, text: t('account.signedOutOthers') })
    } catch (err) {
      setDevicesStatus({ ok: false, text: t('account.signOutOthersError', { error: reason(err) }) })
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setDeleteStatus(undefined)
    try {
      await api('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify(user.hasPassword ? { password: confirmation } : { confirm: confirmation }),
      })
      // The server ended the session; this tidies the page up and returns to the sign-in screen.
      await signOut()
    } catch (err) {
      setDeleteStatus({ ok: false, text: t('account.deleteError', { error: reason(err) }) })
      setBusy(false)
    }
  }

  const providers = user.providers.map((p) => PROVIDER_NAMES[p] ?? p).join(', ')

  return (
    <Card className="flex flex-col items-start gap-4 p-4 nav:p-5" aria-labelledby="account-title">
      <div className="flex flex-col gap-1">
        <h2 id="account-title" className="font-semibold text-strong">
          {t('account.title')}
        </h2>
        <p className="text-sm text-muted">{t('account.note', { name: user.username })}</p>
        {user.isGuest && <p className="text-sm text-muted">{t('account.guestNote')}</p>}
      </div>

      {!user.isGuest && user.hasPassword && (
        <form onSubmit={changePassword} className="flex w-full max-w-sm flex-col gap-3">
          <h3 className="font-semibold text-strong">{t('account.passwordTitle')}</h3>
          {/* Lets a password manager file the new password under the right username. */}
          <input type="text" value={user.username} autoComplete="username" readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
          <Field label={t('account.currentPassword')}>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t('account.newPassword')} hint={t('auth.passwordHint')}>
            <input
              type="password"
              required
              maxLength={128}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={busy} className="self-start">
            {t('account.changePassword')}
          </Button>
          <StatusLine status={passwordStatus} />
        </form>
      )}
      {!user.hasPassword && <p className="text-sm text-muted">{t('account.providerNote', { provider: providers })}</p>}

      {!user.isGuest && (
        <div className="flex flex-col items-start gap-2">
          <h3 className="font-semibold text-strong">{t('account.devicesTitle')}</h3>
          <p className="text-sm text-muted">{t('account.devicesNote')}</p>
          <SecondaryButton disabled={busy} onClick={signOutOthers}>
            {t('account.signOutOthers')}
          </SecondaryButton>
          <StatusLine status={devicesStatus} />
        </div>
      )}

      {!user.isGuest && (
        <div className="flex w-full max-w-sm flex-col items-start gap-2">
          <h3 className="font-semibold text-strong">{t('account.deleteTitle')}</h3>
          <p className="text-sm text-muted">{t('account.deleteNote')}</p>
          {deleting ? (
            <form onSubmit={deleteAccount} className="flex w-full flex-col gap-3">
              <Field
                label={t(user.hasPassword ? 'account.deleteConfirmPassword' : 'account.deleteConfirmUsername', { name: user.username })}
              >
                <input
                  type={user.hasPassword ? 'password' : 'text'}
                  required
                  autoFocus
                  autoComplete={user.hasPassword ? 'current-password' : 'off'}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 min-w-11 cursor-pointer rounded-[10px] bg-danger px-3.5 font-semibold text-danger-contrast transition hover:brightness-110 disabled:cursor-default disabled:opacity-70"
                >
                  {t('account.deleteConfirm')}
                </button>
                <SecondaryButton
                  onClick={() => {
                    setDeleting(false)
                    setConfirmation('')
                    setDeleteStatus(undefined)
                  }}
                >
                  {t('common.cancel')}
                </SecondaryButton>
              </div>
            </form>
          ) : (
            <DangerButton onClick={() => setDeleting(true)}>{t('account.deleteStart')}</DangerButton>
          )}
          <StatusLine status={deleteStatus} />
        </div>
      )}
    </Card>
  )
}
