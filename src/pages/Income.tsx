import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { ConfirmToast } from '../components/ui/ConfirmToast.tsx'
import { Card } from '../components/ui/Card.tsx'
import { AmountField, Field, cardTitleClass, emptyRowClass, inputClass } from '../components/ui/fields.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Income as IncomeEntry, type NewIncome } from '../lib/api.ts'
import { toCents, today } from '../lib/money.ts'

export function Income() {
  const { t, formatMoney, formatIn, ratesReady, formatDate, currency, entryCurrency: defaultEntryCurrency } = usePreferences()
  const { data: entries, error, loading, reload } = useApi<IncomeEntry[]>('/income')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [entryCurrency, setEntryCurrency] = useState(defaultEntryCurrency)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<IncomeEntry>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body: NewIncome = { title, date, currency: entryCurrency, amountCents: toCents(amount) }
    setSubmitting(true)
    try {
      await api('/income', { method: 'POST', body: JSON.stringify(body) })
      setTitle('')
      setAmount('')
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (entry: IncomeEntry) => {
    setPendingDelete(undefined)
    try {
      await api(`/income/${entry.id}`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('income.title')} subtitle={t('income.subtitle')} />

      <Card className="p-4 nav:p-5" aria-labelledby="add-income-title">
        <h2 id="add-income-title" className={`pb-3 ${cardTitleClass}`}>
          {t('income.new')}
        </h2>
        <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-2 nav:grid-cols-3">
          <Field label={t('income.source')} hint={t('hint.source')}>
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('income.sourcePlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field label={t('expenses.date')} hint={t('hint.date')}>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <AmountField
            label={t('expenses.amount')}
            hint={t('hint.amount')}
            amount={amount}
            onAmount={setAmount}
            currency={entryCurrency}
            onCurrency={setEntryCurrency}
          />
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-3">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              {t('income.add')}
            </Button>
            {formError && (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            )}
          </div>
        </form>
      </Card>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="all-income-title">
        <h2 id="all-income-title" className={`pt-3.5 pb-2 ${cardTitleClass}`}>
          {t('income.all')}
        </h2>
        {loading ? (
          <p className={emptyRowClass} role="status">{t('common.loading')}</p>
        ) : error || !entries ? (
          <p className={emptyRowClass} role="alert">
            {t('income.loadError', { error: error ?? '' })}
          </p>
        ) : entries.length === 0 ? (
          <p className={emptyRowClass}>{t('income.empty')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 border-t border-line py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="wrap-anywhere font-medium text-strong">{entry.title}</span>
                  <span className="text-sm text-muted">{formatDate(entry.date)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-strong tabular-nums">
                      {formatMoney(entry.amountCents, entry.currency)}
                    </span>
                    {ratesReady && entry.currency !== currency && (
                      <span className="text-sm text-muted tabular-nums">
                        {formatIn(entry.amountCents, entry.currency)}
                      </span>
                    )}
                  </div>
                  <IconButton onClick={() => setPendingDelete(entry)} aria-label={t('income.deleteLabel', { title: entry.title })}>
                    <Icon name="close" size={18} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendingDelete && (
        <ConfirmToast
          title={t('income.confirmTitle', { title: pendingDelete.title })}
          confirmLabel={t('common.delete')}
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(undefined)}
        >
          {t('income.confirmBody')}
        </ConfirmToast>
      )}
    </div>
  )
}
