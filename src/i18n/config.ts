import { en, type Messages } from './messages/en.ts'
import { ja } from './messages/ja.ts'
import { sv } from './messages/sv.ts'
import { zhTW } from './messages/zh-TW.ts'

export type Language = 'en' | 'sv' | 'ja' | 'zh-TW'
export type Currency = 'SEK' | 'EUR' | 'GBP' | 'JPY' | 'USD' | 'TWD'

/** Plural suffixes (`_one`, `_other`) are folded away: callers pass the base key plus `count`. */
export type MessageKey = {
  [K in keyof Messages]: K extends `${infer Base}_${'one' | 'other'}` ? Base : K
}[keyof Messages]

export const messages: Record<Language, Messages> = { en, sv, ja, 'zh-TW': zhTW }

// `label` is the language's own name, so it stays readable whichever language is active.
export const LANGUAGES: { code: Language; locale: string; label: string }[] = [
  { code: 'en', locale: 'en-US', label: 'English' },
  { code: 'sv', locale: 'sv-SE', label: 'Svenska' },
  { code: 'ja', locale: 'ja-JP', label: '日本語' },
  { code: 'zh-TW', locale: 'zh-TW', label: '繁體中文（台灣）' },
]

export const CURRENCIES: Currency[] = ['SEK', 'EUR', 'GBP', 'JPY', 'USD', 'TWD']

export const DEFAULT_CURRENCY: Currency = 'USD'

/** Decimal places people type for a currency: 2 for most, 0 for yen. Storage is always value × 100. */
export const fractionDigitsFor = (currency: Currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 2

/** Smallest input step for an amount in a currency: 0.01, or 1 for yen. */
export const amountStepFor = (currency: Currency) => 10 ** -fractionDigitsFor(currency)

export const LANGUAGE_STORAGE_KEY = 'expenser-language'
export const CURRENCY_STORAGE_KEY = 'expenser-currency'
export const ENTRY_CURRENCY_STORAGE_KEY = 'expenser-entry-currency'

export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.some((l) => l.code === value)

export const isCurrency = (value: unknown): value is Currency =>
  CURRENCIES.some((c) => c === value)

/** Best match for the browser's language, used until the user picks one. */
export function detectLanguage(): Language {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('sv')) return 'sv'
    if (lower.startsWith('ja')) return 'ja'
    // Traditional script: Taiwan, Hong Kong, Macau, or an explicit Hant tag.
    if (/^zh-(tw|hk|mo|hant)/.test(lower)) return 'zh-TW'
    if (lower.startsWith('en')) return 'en'
  }
  return 'en'
}
