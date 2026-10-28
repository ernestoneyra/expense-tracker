import { createContext, useContext } from 'react'
import type { Currency, Language, MessageKey } from './config.ts'

export interface Rates {
  /** Units of each currency per 1 USD. */
  rates: Record<Currency, number>
  /** When the provider last updated the rates (ISO). */
  updatedAt: string
}

export interface Preferences {
  language: Language
  setLanguage: (language: Language) => void
  /** The currency amounts are shown in. */
  currency: Currency
  setCurrency: (currency: Currency) => void
  locale: string
  /** Translate a message; `{name}` placeholders are filled from `params`, and a numeric `count` selects the plural form. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string
  /**
   * Format an amount stored in minor units (value × 100) that is in `from` (default: the display
   * currency), converting it into the display currency. If the rates aren't available it is shown
   * unconverted in its own currency instead.
   */
  formatMoney: (cents: number, from?: Currency) => string
  /** Format an amount in the given currency, with no conversion. */
  formatIn: (cents: number, currency: Currency) => string
  /** Whether amounts in other currencies can currently be converted. */
  ratesReady: boolean
  /** Format a calendar day stored as UTC midnight. */
  formatDate: (iso: string) => string
  /** Format a ratio as a whole percentage, e.g. 0.42 → "42%". */
  formatPercent: (ratio: number) => string
  /** Format a "YYYY-MM" month as e.g. "Oct 2026". */
  formatMonth: (month: string) => string
  /** Display name of a stored category: the seeded defaults are translated, custom ones are returned as typed. */
  categoryName: (name: string) => string
  /** Localised currency name, e.g. "Japanese Yen". */
  currencyName: (currency: Currency) => string
}

export const PreferencesContext = createContext<Preferences | null>(null)

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return value
}
