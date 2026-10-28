import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { CURRENCIES, amountStepFor, isCurrency, type Currency } from '../../i18n/config.ts'
import { usePreferences } from '../../i18n/PreferencesContext.ts'

// 1.4.11: the edge of a field has 3:1 contrast against what is behind it (border-field).
export const inputClass =
  'min-h-11 w-full rounded-[10px] border border-field bg-surface px-3 text-strong placeholder:text-muted'

/** Shared by the card headings and the empty / error rows inside list cards. */
export const cardTitleClass = 'text-[17px] font-semibold text-strong'
export const emptyRowClass = 'border-t border-line py-6 text-center text-muted'

interface FieldProps {
  label: string
  /** Short help shown under the field and read out with it (3.3.5): what to type, and in what form. */
  hint?: string
  className?: string
  children: ReactNode
}

export function Field({ label, hint, className = '', children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
        id,
        ...(hint ? { 'aria-describedby': hintId } : {}),
      })
    : children
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

/** A number input with a "%" after it. The id and description go to the input, so a `Field` labels it correctly. */
export function PercentInput({ id, 'aria-describedby': describedBy, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        id={id}
        aria-describedby={describedBy}
        type="number"
        inputMode="decimal"
        {...rest}
        className={`${inputClass} pr-8`}
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
        %
      </span>
    </div>
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
  hint?: string
}

/** An amount input with its currency, in the same 65/35 split the expense form uses. */
export function AmountField({ label, amount, onAmount, currency, onCurrency, required = true, hint }: AmountFieldProps) {
  const { t } = usePreferences()
  const id = useId()
  const hintId = `${id}-hint`
  const step = amountStepFor(currency)
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <div className="grid grid-cols-[65fr_35fr] gap-2">
        <input
          id={id}
          required={required}
          type="number"
          min={required ? step : 0}
          step={step}
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder={step < 1 ? '0.00' : '0'}
          aria-describedby={hint ? hintId : undefined}
          className={`${inputClass} min-w-0`}
        />
        {onCurrency ? (
          <select
            value={currency}
            onChange={(e) => isCurrency(e.target.value) && onCurrency(e.target.value)}
            aria-label={`${label}: ${t('expenses.currency')}`}
            className={`${inputClass} min-w-0`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex min-h-11 items-center px-1 text-strong">{currency}</span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * A thin bar showing `ratio` (0–1) of something used; turns red when `over`. It always sits next
 * to the figures in text, so the bar is a supplement and the colour is never the only cue.
 */
export function ProgressBar({ ratio, over = false, label }: { ratio: number; over?: boolean; label: string }) {
  const clamped = Math.min(1, Math.max(0, ratio))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-track"
    >
      <div className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}
