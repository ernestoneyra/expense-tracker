import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { ConfirmToast } from '../components/ui/ConfirmToast.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { useTheme, type ThemePreference } from '../hooks/useTheme.ts'
import { CURRENCIES, LANGUAGES, isCurrency, isLanguage, type MessageKey } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, download, useApi } from '../lib/api.ts'

const inputClass = 'min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong'
const secondaryButtonClass =
  'min-h-10 cursor-pointer rounded-[10px] border border-line px-3.5 font-semibold text-body hover:bg-hover hover:text-strong disabled:cursor-default disabled:opacity-60'

const THEMES: { value: ThemePreference; label: MessageKey }[] = [
  { value: 'system', label: 'settings.themeSystem' },
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' },
]

const isThemePreference = (value: string): value is ThemePreference => THEMES.some((th) => th.value === value)

type Status = { ok: boolean; text: string }

function StatusLine({ status }: { status?: Status }) {
  if (!status) return null
  return (
    <p className={`text-sm ${status.ok ? 'text-muted' : 'text-red-500'}`} role="status">
      {status.text}
    </p>
  )
}

export function Settings() {
  const {
    t,
    locale,
    language,
    setLanguage,
    currency,
    setCurrency,
    entryCurrency,
    hasEntryCurrency,
    setEntryCurrency,
    currencyName,
    ratesInfo,
    ratesLoading,
    refreshRates,
  } = usePreferences()
  const { preference: themePreference, setPreference: setThemePreference } = useTheme()
  // Only a hosted demo has sandboxes to reset; with your own data the card (and the route) don't exist.
  const { data: health } = useApi<{ demo: boolean }>('/health')

  const [confirming, setConfirming] = useState<'reset' | 'import' | 'delete'>()
  const [resetStatus, setResetStatus] = useState<Status>()

  const [refreshing, setRefreshing] = useState(false)
  const [ratesError, setRatesError] = useState<string>()

  const [dataStatus, setDataStatus] = useState<Status>()
  const [busy, setBusy] = useState(false)
  // A backup file that has been read and is waiting for the person to confirm replacing their data.
  const [backup, setBackup] = useState<{ name: string; data: unknown }>()
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = async () => {
    setConfirming(undefined)
    try {
      await api('/sandbox/reset', { method: 'POST' })
      setResetStatus({ ok: true, text: t('settings.resetDone') })
    } catch (err) {
      setResetStatus({ ok: false, text: t('settings.resetError', { error: (err as Error).message }) })
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    setRatesError(undefined)
    try {
      await refreshRates()
    } catch (err) {
      setRatesError(t('settings.ratesRefreshError', { error: (err as Error).message }))
    } finally {
      setRefreshing(false)
    }
  }

  const downloadFile = async (path: string, fallbackName: string) => {
    setBusy(true)
    setDataStatus(undefined)
    try {
      await download(path, fallbackName)
    } catch (err) {
      setDataStatus({ ok: false, text: t('settings.exportError', { error: (err as Error).message }) })
    } finally {
      setBusy(false)
    }
  }

  const pickBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clear the input so choosing the same file again still fires a change event.
    e.target.value = ''
    if (!file) return
    setDataStatus(undefined)
    try {
      setBackup({ name: file.name, data: JSON.parse(await file.text()) })
      setConfirming('import')
    } catch {
      setDataStatus({ ok: false, text: t('settings.importBadFile') })
    }
  }

  const restore = async () => {
    setConfirming(undefined)
    setBusy(true)
    try {
      await api('/data/import', { method: 'POST', body: JSON.stringify(backup?.data) })
      setDataStatus({ ok: true, text: t('settings.importDone') })
    } catch (err) {
      setDataStatus({ ok: false, text: t('settings.importError', { error: (err as Error).message }) })
    } finally {
      setBackup(undefined)
      setBusy(false)
    }
  }

  const deleteAll = async () => {
    setConfirming(undefined)
    setBusy(true)
    try {
      await api('/data', { method: 'DELETE' })
      setDataStatus({ ok: true, text: t('settings.deleteDone') })
    } catch (err) {
      setDataStatus({ ok: false, text: t('settings.deleteError', { error: (err as Error).message }) })
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    setConfirming(undefined)
    setBackup(undefined)
  }

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
            {t('settings.theme')}
            <select
              value={themePreference}
              onChange={(e) => isThemePreference(e.target.value) && setThemePreference(e.target.value)}
              className={inputClass}
            >
              {THEMES.map((th) => (
                <option key={th.value} value={th.value}>
                  {t(th.label)}
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
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('settings.entryCurrency')}
            <select
              value={hasEntryCurrency ? entryCurrency : ''}
              onChange={(e) => setEntryCurrency(isCurrency(e.target.value) ? e.target.value : undefined)}
              className={inputClass}
            >
              <option value="">{t('settings.entryCurrencySame')}</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} – {currencyName(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="pt-3 text-[13px] text-muted">{t('settings.currencyNote')}</p>
        <p className="pt-1 text-[13px] text-muted">{t('settings.entryCurrencyNote')}</p>
      </Card>

      <Card className="flex flex-col items-start gap-3 p-4 nav:p-5">
        <h2 className="font-semibold text-strong">{t('settings.ratesTitle')}</h2>
        {ratesLoading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : ratesInfo ? (
          <>
            <p className="text-sm text-muted">
              {t('settings.ratesUpdated', {
                date: new Date(ratesInfo.updatedAt).toLocaleDateString(locale, { dateStyle: 'medium' }),
                checked: new Date(ratesInfo.fetchedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
              })}
            </p>
            {ratesInfo.stale && (
              <p className="text-sm text-red-500" role="status">
                {t('settings.ratesStale')}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-red-500" role="status">
            {t('settings.ratesUnavailable')}
          </p>
        )}
        <p className="text-[13px] text-muted">{t('settings.ratesNote')}</p>
        <button type="button" onClick={refresh} disabled={refreshing} className={secondaryButtonClass}>
          {refreshing ? t('settings.ratesRefreshing') : t('settings.ratesRefresh')}
        </button>
        {ratesError && (
          <p className="text-sm text-red-500" role="alert">
            {ratesError}
          </p>
        )}
      </Card>

      <Card className="flex flex-col items-start gap-3 p-4 nav:p-5">
        <h2 className="font-semibold text-strong">{t('settings.dataTitle')}</h2>
        <p className="text-[13px] text-muted">{t('settings.dataNote')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => downloadFile('/data/export', 'expenser-backup.json')}
            className={secondaryButtonClass}
          >
            {t('settings.exportBackup')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => downloadFile('/data/export/expenses.csv', 'expenser-expenses.csv')}
            className={secondaryButtonClass}
          >
            {t('settings.exportExpenses')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => downloadFile('/data/export/income.csv', 'expenser-income.csv')}
            className={secondaryButtonClass}
          >
            {t('settings.exportIncome')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={pickBackup}
            className="hidden"
            tabIndex={-1}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className={secondaryButtonClass}
          >
            {t('settings.importBackup')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming('delete')}
            className="min-h-10 cursor-pointer rounded-[10px] border border-red-500 px-3.5 font-semibold text-red-500 hover:bg-red-500 hover:text-white disabled:cursor-default disabled:opacity-60"
          >
            {t('settings.deleteData')}
          </button>
        </div>
        <StatusLine status={dataStatus} />
      </Card>

      {health?.demo && (
        <Card className="flex flex-col items-start gap-3 p-4 nav:p-5">
          <h2 className="font-semibold text-strong">{t('settings.demoTitle')}</h2>
          <p className="text-[13px] text-muted">{t('settings.demoNote')}</p>
          <Button onClick={() => setConfirming('reset')}>{t('settings.resetDemo')}</Button>
          <StatusLine status={resetStatus} />
        </Card>
      )}

      {confirming === 'reset' && (
        <ConfirmToast
          title={t('settings.resetTitle')}
          confirmLabel={t('settings.resetConfirm')}
          onConfirm={reset}
          onCancel={cancel}
        >
          {t('settings.resetBody')}
        </ConfirmToast>
      )}
      {confirming === 'import' && backup && (
        <ConfirmToast
          title={t('settings.importTitle')}
          confirmLabel={t('settings.importConfirm')}
          onConfirm={restore}
          onCancel={cancel}
        >
          {t('settings.importBody', { file: backup.name })}
        </ConfirmToast>
      )}
      {confirming === 'delete' && (
        <ConfirmToast
          title={t('settings.deleteTitle')}
          confirmLabel={t('settings.deleteConfirm')}
          onConfirm={deleteAll}
          onCancel={cancel}
        >
          {t('settings.deleteBody')}
        </ConfirmToast>
      )}
    </div>
  )
}
