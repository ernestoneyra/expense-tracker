import { useEffect, type ReactNode } from 'react'

interface ConfirmToastProps {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmToast({ title, children, confirmLabel, onConfirm, onCancel }: ConfirmToastProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="alertdialog"
      aria-labelledby="confirm-toast-title"
      aria-describedby="confirm-toast-body"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 shadow-[var(--shadow)]"
    >
      <div className="flex flex-col gap-1">
        <p id="confirm-toast-title" className="font-semibold text-strong">
          {title}
        </p>
        <p id="confirm-toast-body" className="text-sm text-muted">
          {children}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="min-h-10 cursor-pointer rounded-[10px] border border-line px-3.5 font-semibold text-body hover:bg-hover hover:text-strong"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-10 cursor-pointer rounded-[10px] bg-red-500 px-3.5 font-semibold text-white transition hover:brightness-110"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
