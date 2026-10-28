import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { AmountField, Field, cardTitleClass, emptyRowClass, inputClass } from '../components/ui/fields.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { categoryIcon } from '../config/categoryIcons.ts'
import type { MessageKey } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Category, type Frequency, type RecurringItem, type RecurringResponse } from '../lib/api.ts'
import { toCents, today } from '../lib/money.ts'

const frequencyLabel: Record<Frequency, MessageKey> = {
  weekly: 'recurring.weekly',
  monthly: 'recurring.monthly',
  yearly: 'recurring.yearly',
}

export function Recurring() {
  const { t, formatMoney, formatIn, ratesReady, formatDate, currency, categoryName } = usePreferences()
  const { data, error, loading, reload } = useApi<RecurringResponse>(`/recurring?currency=${currency}`)
  const { data: categories } = useApi<Category[]>('/categories')
  const [kind, setKind] = useState<'expense' | 'income'>('expense')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [itemCurrency, setItemCurrency] = useState(currency)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [startDate, setStartDate] = useState(today)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api('/recurring', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          title,
          category: kind === 'expense' ? category : undefined,
          currency: itemCurrency,
          amountCents: toCents(amount),
          frequency,
          startDate,
        }),
      })
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

  const act = async (path: string, init: RequestInit) => {
    try {
      await api(path, init)
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const row = (item: RecurringItem) => (
    <li
      key={item.id}
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 ${item.active ? '' : 'opacity-60'}`}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-strong">{item.title}</span>
        <span className="flex items-center gap-1 text-[13px] text-muted">
          {item.category && <Icon name={categoryIcon(item.category)} size={13} className="shrink-0" />}
          {item.category && `${categoryName(item.category)} · `}
          {t(frequencyLabel[item.frequency])} ·{' '}
          {item.active ? t('recurring.nextDue', { date: formatDate(item.nextDue) }) : t('recurring.paused')}
        </span>
        {item.kind === 'expense' && item.frequency === 'yearly' && (
          <span className="text-[13px] text-muted">{t('recurring.setAside', { amount: formatMoney(item.monthlyCents) })}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex flex-col items-end">
          <span className={`font-semibold tabular-nums ${item.kind === 'income' ? 'text-accent-text' : 'text-strong'}`}>
            {formatMoney(item.amountCents, item.currency)}
          </span>
          {ratesReady && item.currency !== currency && (
            <span className="text-[13px] text-muted tabular-nums">{formatIn(item.amountCents, item.currency)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => act(`/recurring/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) })}
          className="min-h-9 cursor-pointer rounded-[10px] px-2.5 text-sm font-medium text-body hover:bg-hover hover:text-strong"
        >
          {item.active ? t('recurring.pause') : t('recurring.resume')}
        </button>
        <IconButton
          onClick={() => act(`/recurring/${item.id}`, { method: 'DELETE' })}
          aria-label={t('recurring.deleteLabel', { title: item.title })}
        >
          <Icon name="close" size={18} />
        </IconButton>
      </div>
    </li>
  )

  const bills = data?.items.filter((i) => i.kind === 'expense') ?? []
  const paychecks = data?.items.filter((i) => i.kind === 'income') ?? []

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('recurring.title')} subtitle={t('recurring.subtitle')} />

      <Card className="p-4 nav:p-5" aria-labelledby="add-recurring-title">
        <h2 id="add-recurring-title" className={`pb-3 ${cardTitleClass}`}>
          {t('recurring.new')}
        </h2>
        <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-2 nav:grid-cols-4">
          <Field label={t('recurring.kind')}>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'expense' | 'income')} className={inputClass}>
              <option value="expense">{t('recurring.bill')}</option>
              <option value="income">{t('recurring.paycheck')}</option>
            </select>
          </Field>
          <Field label={t('expenses.fieldTitle')}>
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(kind === 'expense' ? 'recurring.billPlaceholder' : 'recurring.paycheckPlaceholder')}
              className={inputClass}
            />
          </Field>
          {kind === 'expense' && (
            <Field label={t('expenses.category')}>
              <select required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  {t('expenses.selectCategory')}
                </option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.name}>
                    {categoryName(c.name)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <AmountField
            label={t('expenses.amount')}
            amount={amount}
            onAmount={setAmount}
            currency={itemCurrency}
            onCurrency={setItemCurrency}
          />
          <Field label={t('recurring.frequency')}>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={inputClass}>
              {(Object.keys(frequencyLabel) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {t(frequencyLabel[f])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('recurring.startDate')}>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </Field>
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-4">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              {t('recurring.add')}
            </Button>
            {formError && (
              <p className="text-sm text-red-500" role="alert">
                {formError}
              </p>
            )}
          </div>
        </form>
        <p className="pt-3 text-sm text-muted">{t('recurring.howItWorks')}</p>
      </Card>

      {data && (data.totals.expensesCents > 0 || data.totals.incomeCents > 0) && (
        <section className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3 nav:gap-4" aria-label={t('recurring.totals')}>
          {[
            { id: 'bills', label: t('recurring.monthlyBills'), value: data.totals.expensesCents },
            { id: 'income', label: t('recurring.monthlyIncome'), value: data.totals.incomeCents },
            { id: 'sinking', label: t('recurring.sinkingFund'), value: data.totals.sinkingFundCents, hint: t('recurring.sinkingFundHint') },
          ].map((s) => (
            <Card key={s.id} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="truncate text-xl font-bold tracking-tight text-strong">{formatMoney(s.value)}</p>
              {s.hint && <p className="text-[13px] text-muted">{s.hint}</p>}
            </Card>
          ))}
        </section>
      )}

      {(
        [
          { id: 'bills', title: t('recurring.bills'), items: bills },
          { id: 'paychecks', title: t('recurring.paychecks'), items: paychecks },
        ] as const
      ).map((group) => (
        <Card key={group.id} className="px-5 pt-2 pb-3" aria-labelledby={`${group.id}-title`}>
          <h2 id={`${group.id}-title`} className={`pt-3.5 pb-2 ${cardTitleClass}`}>
            {group.title}
          </h2>
          {loading ? (
            <p className={emptyRowClass}>{t('common.loading')}</p>
          ) : error || !data ? (
            <p className={emptyRowClass} role="alert">
              {t('recurring.loadError', { error: error ?? '' })}
            </p>
          ) : group.items.length === 0 ? (
            <p className={emptyRowClass}>{t('recurring.empty')}</p>
          ) : (
            <ul className="m-0 list-none p-0">{group.items.map(row)}</ul>
          )}
        </Card>
      ))}
    </div>
  )
}
