import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext.ts'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import { IconButton, SecondaryButton } from '../ui/Button.tsx'
import { Icon } from '../ui/Icon.tsx'

/**
 * Who is signed in, a way to their account settings, and sign out. A disclosure: the button opens
 * and closes a panel of ordinary links and buttons, Escape closes it and returns focus to the button,
 * and so does moving focus or clicking outside.
 */
export function AccountMenu() {
  const { t } = usePreferences()
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onOutside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('focusin', onOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('focusin', onOutside)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <IconButton
        ref={button}
        className="rounded-full border border-field"
        aria-label={user ? `${t('header.account')}: ${user.username}` : t('header.account')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="user" />
      </IconButton>
      {open && (
        <div
          id={panelId}
          className="absolute top-full right-0 z-40 mt-2 flex w-64 flex-col gap-3 rounded-[14px] border border-field bg-surface p-4 shadow-(--shadow)"
        >
          <p className="font-semibold break-words text-strong">
            {user ? t('account.signedInAs', { name: user.username }) : t('account.demoUser')}
          </p>
          {user && (
            <a
              href="#/settings/account"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center font-semibold text-accent-text underline underline-offset-2"
            >
              {t('account.settings')}
            </a>
          )}
          <SecondaryButton
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
          >
            {t(user ? 'account.signOut' : 'account.leaveDemo')}
          </SecondaryButton>
        </div>
      )}
    </div>
  )
}
