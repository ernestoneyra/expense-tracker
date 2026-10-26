import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { api, formatDate, formatMoney, useApi, type Summary } from '../lib/api.ts'

function changeHint(spent: number, prev: number) {
  if (prev === 0) return 'no spending last month'
  const pct = Math.round(((spent - prev) / prev) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}% vs last month`
}

export function Dashboard() {
  const { data, error, loading, reload } = useApi<Summary>('/summary')
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetError, setBudgetError] = useState<string>()

  if (loading) return <p className="text-muted">Loading…</p>
  if (error || !data) {
    return (
      <p className="text-muted" role="alert">
        Couldn't load the dashboard: {error ?? 'no data'}. Is the API server running?
      </p>
    )
  }

  const stats = [
    {
      label: 'Spent this month',
      value: formatMoney(data.spentCents),
      hint: changeHint(data.spentCents, data.prevSpentCents),
    },
    {
      label: 'Budget left',
      value: formatMoney(data.budgetCents - data.spentCents),
      hint: data.budgetCents ? `of ${formatMoney(data.budgetCents)}` : 'no budget set',
    },
    {
      label: 'Top category',
      value: data.topCategory?.name ?? '—',
      hint: data.topCategory ? formatMoney(data.topCategory.cents) : 'no spending yet',
    },
    { label: 'Transactions', value: String(data.transactions), hint: 'this month' },
  ]

  const saveBudget = async (e: FormEvent) => {
    e.preventDefault()
    const dollars = Number(budgetInput)
    if (!Number.isFinite(dollars) || dollars < 0) {
      setBudgetError('Enter a valid amount')
      return
    }
    try {
      await api('/budget', {
        method: 'PUT',
        body: JSON.stringify({ monthlyCents: Math.round(dollars * 100) }),
      })
      setEditingBudget(false)
      setBudgetError(undefined)
      reload()
    } catch (err) {
      setBudgetError((err as Error).message)
    }
  }

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title="Dashboard" subtitle="A quick look at where your money is going." />

      <section
        className="grid grid-cols-2 gap-3 nav:grid-cols-4 nav:gap-4"
        aria-label="Summary"
      >
        {stats.map((s) => (
          <Card key={s.label} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="truncate text-xl font-bold tracking-tight text-strong min-[420px]:text-2xl">
              {s.value}
            </p>
            <p className="text-[13px] text-muted">{s.hint}</p>
            {s.label === 'Budget left' &&
              (editingBudget ? (
                <form onSubmit={saveBudget} className="mt-1 flex flex-col gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    aria-label="Monthly budget in dollars"
                    placeholder="Monthly budget"
                    className="min-h-9 w-full rounded-[10px] border border-line bg-surface px-2.5 text-strong"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="min-h-8 flex-1 text-sm">
                      Save
                    </Button>
                    <button
                      type="button"
                      className="cursor-pointer text-sm text-muted hover:text-strong"
                      onClick={() => {
                        setEditingBudget(false)
                        setBudgetError(undefined)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {budgetError && (
                    <p className="text-[13px] text-red-500" role="alert">
                      {budgetError}
                    </p>
                  )}
                </form>
              ) : (
                <button
                  type="button"
                  className="mt-1 cursor-pointer self-start text-[13px] font-medium text-accent-text hover:underline"
                  onClick={() => {
                    setBudgetInput(data.budgetCents ? String(data.budgetCents / 100) : '')
                    setEditingBudget(true)
                  }}
                >
                  {data.budgetCents ? 'Edit budget' : 'Set budget'}
                </button>
              ))}
          </Card>
        ))}
      </section>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="recent-title">
        <h2 id="recent-title" className="pt-3.5 pb-2 text-[17px] font-semibold text-strong">
          Recent expenses
        </h2>
        {data.recent.length === 0 ? (
          <p className="border-t border-line py-6 text-center text-muted">
            No expenses yet. Use "Add expense" to create your first one.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.recent.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 border-t border-line py-3.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-strong">{e.title}</span>
                  <span className="text-[13px] text-muted">
                    {e.category} · {formatDate(e.date)}
                  </span>
                </div>
                <span className="shrink-0 font-semibold text-strong tabular-nums">
                  {formatMoney(e.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
