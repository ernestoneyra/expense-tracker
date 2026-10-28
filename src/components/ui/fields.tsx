import type { ReactNode } from 'react'
import { CURRENCIES, amountStepFor, isCurrency, type Currency } from '../../i18n/config.ts'
import { usePreferences } from '../../i18n/PreferencesContext.ts'

export const inputClass =
  'min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong placeholder:text-muted'

/** Shared by the card headings and the empty / error rows inside list cards. */
export const cardTitleClass = 'text-[17px] font-semibold text-strong'
export const emptyRowClass = 'border-t border-line py-6 text-center text-muted'

export function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-muted ${className}`}>
      {label}
      {children}
    </label>
  )
}

interface AmountFieldProps {
  label: string
  amount: string
  onAmount: (amount: string) => void
  currency: Currency
  /** Omit to show the currency as fixed text instead of a picker. */
  onCurrency?: (currency: Currency) => void
  required?: boolean
}

/** An amount input with its currency, in the same 65/35 split the expense form uses. */
export function AmountField({ label, amount, onAmount, currency, onCurrency, required = true }: AmountFieldProps) {
  const { t } = usePreferences()
  const step = amountStepFor(currency)
  return (
    <Field label={label}>
      <div className="grid grid-cols-[65fr_35fr] gap-2">
        <input
          required={required}
          type="number"
          min={required ? step : 0}
          step={step}
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder={step < 1 ? '0.00' : '0'}
          className={`${inputClass} min-w-0`}
        />
        {onCurrency ? (
          <select
            value={currency}
            onChange={(e) => isCurrency(e.target.value) && onCurrency(e.target.value)}
            aria-label={t('expenses.currency')}
            className={`${inputClass} min-w-0`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex min-h-10 items-center px-1 text-strong">{currency}</span>
        )}
      </div>
    </Field>
  )
}

/** A thin bar showing `ratio` (0–1) of something used; turns red when `over`. */
export function ProgressBar({ ratio, over = false, label }: { ratio: number; over?: boolean; label: string }) {
  const clamped = Math.min(1, Math.max(0, ratio))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-hover"
    >
      <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-accent'}`} style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}
