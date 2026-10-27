import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { fractionDigitsFor, amountStepFor } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Summary } from '../lib/api.ts'

export function Dashboard() {
  const { t, formatMoney, formatIn, ratesReady, formatDate, currency } = usePreferences()
  // Amounts come back converted into the display currency, so changing it refetches.
  const { data, error, loading, reload } = useApi<Summary>(`/summary?currency=${currency}`)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetError, setBudgetError] = useState<string>()

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (error || !data) {
    return (
      <p className="text-muted" role="alert">
        {t('dashboard.loadError', { error: error ?? t('dashboard.noData') })}
      </p>
    )
  }

  const changeHint = (spent: number, prev: number) => {
    if (prev === 0) return t('dashboard.noSpendingLastMonth')
    const pct = Math.round(((spent - prev) / prev) * 100)
    return t('dashboard.vsLastMonth', { change: `${pct >= 0 ? '+' : ''}${pct}%` })
  }

  const stats = [
    {
      id: 'spent',
      label: t('dashboard.spent'),
      value: formatMoney(data.spentCents),
      hint: changeHint(data.spentCents, data.prevSpentCents),
    },
    {
      id: 'budget',
      label: t('dashboard.budgetLeft'),
      value: formatMoney(data.budgetCents - data.spentCents),
      hint: data.budgetCents
        ? t('dashboard.ofBudget', { amount: formatMoney(data.budgetCents) })
        : t('dashboard.noBudget'),
    },
    {
      id: 'top',
      label: t('dashboard.topCategory'),
      value: data.topCategory?.name ?? '—',
      hint: data.topCategory ? formatMoney(data.topCategory.cents) : t('dashboard.noSpendingYet'),
    },
    {
      id: 'transactions',
      label: t('dashboard.transactions'),
      value: String(data.transactions),
      hint: t('dashboard.thisMonth'),
    },
  ]

  const saveBudget = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(budgetInput)
    if (!Number.isFinite(amount) || amount < 0) {
      setBudgetError(t('dashboard.invalidAmount'))
      return
    }
    try {
      await api('/budget', {
        method: 'PUT',
        body: JSON.stringify({ monthlyCents: Math.round(amount * 100), currency }),
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
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <section
        className="grid grid-cols-2 gap-3 nav:grid-cols-4 nav:gap-4"
        aria-label={t('dashboard.title')}
      >
        {stats.map((s) => (
          <Card key={s.id} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="truncate text-xl font-bold tracking-tight text-strong min-[420px]:text-2xl">
              {s.value}
            </p>
            <p className="text-[13px] text-muted">{s.hint}</p>
            {s.id === 'budget' &&
              (editingBudget ? (
                <form onSubmit={saveBudget} className="mt-1 flex flex-col gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step={amountStepFor(currency)}
                    autoFocus
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    aria-label={t('dashboard.budgetLabel')}
                    placeholder={t('dashboard.budgetLabel')}
                    className="min-h-9 w-full rounded-[10px] border border-line bg-surface px-2.5 text-strong"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="min-h-8 flex-1 text-sm">
                      {t('common.save')}
                    </Button>
                    <button
                      type="button"
                      className="cursor-pointer text-sm text-muted hover:text-strong"
                      onClick={() => {
                        setEditingBudget(false)
                        setBudgetError(undefined)
                      }}
                    >
                      {t('common.cancel')}
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
                    setBudgetInput(
                      data.budgetCents
                        ? String(Number((data.budgetCents / 100).toFixed(fractionDigitsFor(currency))))
                        : '',
                    )
                    setEditingBudget(true)
                  }}
                >
                  {data.budgetCents ? t('dashboard.editBudget') : t('dashboard.setBudget')}
                </button>
              ))}
          </Card>
        ))}
      </section>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="recent-title">
        <h2 id="recent-title" className="pt-3.5 pb-2 text-[17px] font-semibold text-strong">
          {t('dashboard.recent')}
        </h2>
        {data.recent.length === 0 ? (
          <p className="border-t border-line py-6 text-center text-muted">
            {t('dashboard.recentEmpty')}
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
                  {e.description && (
                    <span className="truncate text-[13px] text-muted">{e.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold text-strong tabular-nums">
                    {formatMoney(e.amountCents, e.currency)}
                  </span>
                  {ratesReady && e.currency !== currency && (
                    <span className="text-[13px] text-muted tabular-nums">
                      {formatIn(e.amountCents, e.currency)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
