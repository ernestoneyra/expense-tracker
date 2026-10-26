import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import {
  api,
  formatDate,
  formatMoney,
  useApi,
  type Category,
  type Expense,
  type NewExpense,
} from '../lib/api.ts'

const inputClass =
  'min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong placeholder:text-muted'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export function Expenses() {
  const { data: expenses, error, loading, reload } = useApi<Expense[]>('/expenses')
  const { data: categories } = useApi<Category[]>('/categories')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body: NewExpense = {
      title,
      category,
      description,
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
      <PageHeader title="Expenses" subtitle="Add and review everything you've spent." />

      <Card className="p-4 nav:p-5" aria-labelledby="add-title">
        <h2 id="add-title" className="pb-3 text-[17px] font-semibold text-strong">
          New expense
        </h2>
        <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-2 nav:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Title
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Whole Foods"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Category
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Date
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Amount ($)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted min-[560px]:col-span-2 nav:col-span-4">
            Description (optional)
            <input
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Weekly groceries"
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-4">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              Add expense
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
          All expenses
        </h2>
        {loading ? (
          <p className="border-t border-line py-6 text-center text-muted">Loading…</p>
        ) : error || !expenses ? (
          <p className="border-t border-line py-6 text-center text-muted" role="alert">
            Couldn't load expenses: {error}. Is the API server running?
          </p>
        ) : expenses.length === 0 ? (
          <p className="border-t border-line py-6 text-center text-muted">No expenses yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border-t border-line py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-strong">{e.title}</span>
                  <span className="text-[13px] text-muted">
                    {e.category} · {formatDate(e.date)}
                  </span>
                  {e.description && (
                    <span className="truncate text-[13px] text-muted">{e.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold text-strong tabular-nums">
                    {formatMoney(e.amountCents)}
                  </span>
                  <IconButton onClick={() => remove(e.id)} aria-label={`Delete ${e.title}`}>
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
