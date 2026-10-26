import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { CURRENCIES, LANGUAGES, isCurrency, isLanguage } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'

const inputClass = 'min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong'

export function Settings() {
  const { t, language, setLanguage, currency, setCurrency, currencyName } = usePreferences()

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Card className="p-4 nav:p-5">
        <div className="grid gap-4 min-[560px]:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('settings.language')}
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
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('settings.currency')}
            <select
              value={currency}
              onChange={(e) => isCurrency(e.target.value) && setCurrency(e.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} – {currencyName(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="pt-3 text-[13px] text-muted">{t('settings.currencyNote')}</p>
      </Card>
    </div>
  )
}
