import { useEffect, useId, useRef, type ReactNode } from 'react'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import { SecondaryButton } from './Button.tsx'

interface ConfirmToastProps {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Asks before something that cannot be undone (3.3.6). It is a modal <dialog>, so focus stays
 * inside it, the page behind cannot be reached or hidden under it (2.4.12), Escape cancels, and
 * focus returns to the button that opened it.
 */
export function ConfirmToast({ title, children, confirmLabel, onConfirm, onCancel }: ConfirmToastProps) {
  const { t } = usePreferences()
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement
    if (!element.open) element.showModal()
    return () => {
      element.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      // Escape: let the parent unmount the dialog instead of the browser closing it on its own.
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="fixed inset-x-0 top-auto bottom-0 mx-auto mb-4 w-[calc(100%-2rem)] max-w-md rounded-[14px] border border-field bg-surface p-4 text-body shadow-(--shadow) backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p id={`${id}-title`} className="font-semibold text-strong">
            {title}
          </p>
          <p id={`${id}-body`} className="text-sm text-muted">
            {children}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <SecondaryButton autoFocus onClick={onCancel}>
            {t('common.cancel')}
          </SecondaryButton>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 min-w-11 cursor-pointer rounded-[10px] bg-danger px-3.5 font-semibold text-danger-contrast transition hover:brightness-110"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
