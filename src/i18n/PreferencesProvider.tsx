import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CURRENCY_STORAGE_KEY,
  DEFAULT_CURRENCY,
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  detectLanguage,
  isCurrency,
  isLanguage,
  messages,
  type Currency,
  type Language,
} from './config.ts'
import { useApi } from '../lib/api.ts'
import { PreferencesContext, type Preferences, type Rates } from './PreferencesContext.ts'

function readSaved<T>(key: string, isValid: (value: unknown) => value is T): T | undefined {
  try {
    const saved = localStorage.getItem(key)
    if (isValid(saved)) return saved
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore: the choice just won't persist.
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(
    () => readSaved(LANGUAGE_STORAGE_KEY, isLanguage) ?? detectLanguage(),
  )
  const [currency, setCurrencyState] = useState<Currency>(
    () => readSaved(CURRENCY_STORAGE_KEY, isCurrency) ?? DEFAULT_CURRENCY,
  )

  // Exchange rates come from the server (which caches them); without them, amounts in a
  // currency other than the display one are shown unconverted.
  const { data: rates } = useApi<Rates>('/rates')

  // The lang attribute also lets the browser pick the right CJK glyph variants.
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    save(LANGUAGE_STORAGE_KEY, next)
    setLanguageState(next)
  }, [])

  const setCurrency = useCallback((next: Currency) => {
    save(CURRENCY_STORAGE_KEY, next)
    setCurrencyState(next)
  }, [])

  const value = useMemo<Preferences>(() => {
    const locale = LANGUAGES.find((l) => l.code === language)!.locale
    const dictionary: Record<string, string> = messages[language]
    const plurals = new Intl.PluralRules(locale)
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
    const currencyNames = new Intl.DisplayNames(locale, { type: 'currency' })
    const formatters = new Map<Currency, Intl.NumberFormat>([[currency, money]])
    const formatterFor = (c: Currency) => {
      let f = formatters.get(c)
      if (!f) formatters.set(c, (f = new Intl.NumberFormat(locale, { style: 'currency', currency: c })))
      return f
    }

    return {
      language,
      locale,
      setLanguage,
      currency,
      setCurrency,
      t: (key, params) => {
        let template = dictionary[key]
        if (typeof params?.count === 'number') {
          template =
            dictionary[`${key}_${plurals.select(params.count)}`] ??
            dictionary[`${key}_other`] ??
            template
        }
        return template.replace(/\{(\w+)\}/g, (match, name: string) =>
          params && name in params ? String(params[name]) : match,
        )
      },
      // Amounts are always stored as value × 100, whatever the currency's own minor unit is,
      // so converting is a plain ratio of the two rates.
      formatMoney: (cents, from = currency) =>
        from === currency
          ? money.format(cents / 100)
          : rates
            ? money.format(((cents * rates.rates[currency]) / rates.rates[from]) / 100)
            : formatterFor(from).format(cents / 100),
      formatIn: (cents, c) => formatterFor(c).format(cents / 100),
      ratesReady: rates !== undefined,
      // Dates are calendar days stored at UTC midnight, so format in UTC to avoid off-by-one shifts.
      formatDate: (iso) =>
        new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      // Categories are stored (and referenced by expenses) under their English default name.
      categoryName: (name) => dictionary[`category.${name}`] ?? name,
      currencyName: (c) => currencyNames.of(c) ?? c,
    }
  }, [language, currency, rates, setLanguage, setCurrency])

  return <PreferencesContext value={value}>{children}</PreferencesContext>
}
