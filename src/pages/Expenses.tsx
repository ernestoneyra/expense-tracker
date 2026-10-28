import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { ConfirmToast } from '../components/ui/ConfirmToast.tsx'
import { AmountField, Field, inputClass } from '../components/ui/fields.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { categoryIcon } from '../config/categoryIcons.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Category, type Expense, type NewExpense } from '../lib/api.ts'
import { today } from '../lib/money.ts'

export function Expenses() {
  const { t, formatMoney, formatIn, ratesReady, formatDate, currency, entryCurrency, categoryName } = usePreferences()
  const { data: expenses, error, loading, reload } = useApi<Expense[]>('/expenses')
  const { data: categories } = useApi<Category[]>('/categories')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  // Starts as the default entry currency; each expense keeps the currency it is entered in.
  const [expenseCurrency, setExpenseCurrency] = useState(entryCurrency)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<Expense>()

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

  const remove = async (expense: Expense) => {
    setPendingDelete(undefined)
    try {
      await api(`/expenses/${expense.id}`, { method: 'DELETE' })
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
          <Field label={t('expenses.fieldTitle')} hint={t('hint.title')}>
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('expenses.titlePlaceholder')}
              className={inputClass}
            />
          </Field>
          <Field label={t('expenses.category')} hint={t('hint.category')}>
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
          <Field label={t('expenses.date')} hint={t('hint.date')}>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <AmountField
            label={t('expenses.amount')}
            hint={t('hint.amount')}
            amount={amount}
            onAmount={setAmount}
            currency={expenseCurrency}
            onCurrency={setExpenseCurrency}
          />
          <Field
            label={t('expenses.description')}
            hint={t('hint.description')}
            className="min-[560px]:col-span-2 nav:col-span-4"
          >
            <input
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('expenses.descriptionPlaceholder')}
              className={inputClass}
            />
          </Field>
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-4">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              {t('expenses.add')}
            </Button>
            {formError && (
              <p className="text-sm text-danger" role="alert">
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
          <p className="border-t border-line py-6 text-center text-muted" role="status">{t('common.loading')}</p>
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
                  <span className="wrap-anywhere font-medium text-strong">{e.title}</span>
                  <span className="flex items-center gap-1 text-sm text-muted">
                    <Icon name={categoryIcon(e.category)} size={13} className="shrink-0" />
                    {categoryName(e.category)} · {formatDate(e.date)}
                  </span>
                  {e.description && (
                    <span className="wrap-anywhere text-sm text-muted">{e.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-strong tabular-nums">
                      {formatMoney(e.amountCents, e.currency)}
                    </span>
                    {ratesReady && e.currency !== currency && (
                      <span className="text-sm text-muted tabular-nums">
                        {formatIn(e.amountCents, e.currency)}
                      </span>
                    )}
                  </div>
                  <IconButton onClick={() => setPendingDelete(e)} aria-label={t('expenses.deleteLabel', { title: e.title })}>
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
          title={t('expenses.confirmTitle', { title: pendingDelete.title })}
          confirmLabel={t('common.delete')}
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(undefined)}
        >
          {t('expenses.confirmBody')}
        </ConfirmToast>
      )}
    </div>
  )
}
