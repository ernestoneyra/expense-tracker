import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { categoryIcon } from '../config/categoryIcons.ts'
import { CURRENCIES, amountStepFor, isCurrency } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Category, type Expense, type NewExpense } from '../lib/api.ts'

const inputClass =
  'min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong placeholder:text-muted'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export function Expenses() {
  const { t, formatMoney, formatIn, ratesReady, formatDate, currency, categoryName } = usePreferences()
  const { data: expenses, error, loading, reload } = useApi<Expense[]>('/expenses')
  const { data: categories } = useApi<Category[]>('/categories')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  // Starts as the display currency; each expense keeps the currency it is entered in.
  const [expenseCurrency, setExpenseCurrency] = useState(currency)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body: NewExpense = {
      title,
      category,
      description,
      currency: expenseCurrency,
      date,
      amountCents: Math.round(Number(amount) * 100),
    }
    setSubmitting(true)
    try {
      await api('/expenses', { method: 'POST', body: JSON.stringify(body) })
      setTitle('')
      setDescription('')
      setAmount('')
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api(`/expenses/${id}`, { method: 'DELETE' })
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')} />

      <Card className="p-4 nav:p-5" aria-labelledby="add-title">
        <h2 id="add-title" className="pb-3 text-[17px] font-semibold text-strong">
          {t('expenses.new')}
        </h2>
        <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-2 nav:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('expenses.fieldTitle')}
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('expenses.titlePlaceholder')}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('expenses.category')}
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                {t('expenses.selectCategory')}
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {categoryName(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('expenses.date')}
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t('expenses.amount')}
            <div className="grid grid-cols-[65fr_35fr] gap-2">
              <input
                required
                type="number"
                min={amountStepFor(expenseCurrency)}
                step={amountStepFor(expenseCurrency)}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={amountStepFor(expenseCurrency) < 1 ? '0.00' : '0'}
                className={`${inputClass} min-w-0`}
              />
              <select
                value={expenseCurrency}
                onChange={(e) => isCurrency(e.target.value) && setExpenseCurrency(e.target.value)}
                aria-label={t('expenses.currency')}
                className={`${inputClass} min-w-0`}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted min-[560px]:col-span-2 nav:col-span-4">
            {t('expenses.description')}
            <input
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('expenses.descriptionPlaceholder')}
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-4">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              {t('expenses.add')}
            </Button>
            {formError && (
              <p className="text-sm text-red-500" role="alert">
                {formError}
              </p>
            )}
          </div>
        </form>
      </Card>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="all-title">
        <h2 id="all-title" className="pt-3.5 pb-2 text-[17px] font-semibold text-strong">
          {t('expenses.all')}
        </h2>
        {loading ? (
          <p className="border-t border-line py-6 text-center text-muted">{t('common.loading')}</p>
        ) : error || !expenses ? (
          <p className="border-t border-line py-6 text-center text-muted" role="alert">
            {t('expenses.loadError', { error: error ?? '' })}
          </p>
        ) : expenses.length === 0 ? (
          <p className="border-t border-line py-6 text-center text-muted">{t('expenses.empty')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border-t border-line py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-strong">{e.title}</span>
                  <span className="flex items-center gap-1 text-[13px] text-muted">
                    <Icon name={categoryIcon(e.category)} size={13} className="shrink-0" />
                    {categoryName(e.category)} · {formatDate(e.date)}
                  </span>
                  {e.description && (
                    <span className="truncate text-[13px] text-muted">{e.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-strong tabular-nums">
                      {formatMoney(e.amountCents, e.currency)}
                    </span>
                    {ratesReady && e.currency !== currency && (
                      <span className="text-[13px] text-muted tabular-nums">
                        {formatIn(e.amountCents, e.currency)}
                      </span>
                    )}
                  </div>
                  <IconButton onClick={() => remove(e.id)} aria-label={t('expenses.deleteLabel', { title: e.title })}>
                    <Icon name="close" size={18} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
