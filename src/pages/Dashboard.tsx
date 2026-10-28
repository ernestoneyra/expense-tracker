import { useState, type FormEvent } from 'react'
import { Button, LinkButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { categoryIcon } from '../config/categoryIcons.ts'
import { fractionDigitsFor, amountStepFor } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Summary } from '../lib/api.ts'

export function Dashboard() {
  const { t, formatMoney, formatIn, formatPercent, ratesReady, formatDate, currency, categoryName } = usePreferences()
  // Amounts come back converted into the display currency, so changing it refetches.
  const { data, error, loading, reload } = useApi<Summary>(`/summary?currency=${currency}`)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetError, setBudgetError] = useState<string>()

  // The heading is there while loading or after an error, so the page always has one.
  if (loading || error || !data) {
    return (
      <div className="flex max-w-275 flex-col gap-6">
        <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
        {loading ? (
          <p className="text-muted" role="status">
            {t('common.loading')}
          </p>
        ) : (
          <p className="text-muted" role="alert">
            {t('dashboard.loadError', { error: error ?? t('dashboard.noData') })}
          </p>
        )}
      </div>
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
      value: data.topCategory ? categoryName(data.topCategory.name) : '—',
      hint: data.topCategory ? formatMoney(data.topCategory.cents) : t('dashboard.noSpendingYet'),
    },
    {
      id: 'transactions',
      label: t('dashboard.transactions'),
      value: String(data.transactions),
      hint: t('dashboard.thisMonth'),
    },
  ]

  // Only shown once there is income this month to compare against.
  const net = data.incomeCents - data.spentCents
  const cashFlow = [
    { id: 'income', label: t('dashboard.income'), value: formatMoney(data.incomeCents), hint: t('dashboard.thisMonth') },
    { id: 'net', label: t('dashboard.net'), value: formatMoney(net), hint: t('dashboard.netHint') },
    {
      id: 'rate',
      label: t('dashboard.savingsRate'),
      value: formatPercent(net / data.incomeCents),
      hint: t('dashboard.savingsRateHint'),
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
        aria-labelledby="dashboard-summary-title"
      >
        <h2 id="dashboard-summary-title" className="sr-only">
          {t('dashboard.summary')}
        </h2>
        {stats.map((s) => (
          <Card key={s.id} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="wrap-anywhere text-xl font-bold tracking-tight text-strong min-[420px]:text-2xl">
              {s.value}
            </p>
            <p className="text-sm text-muted">{s.hint}</p>
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
                    aria-describedby="budget-hint"
                    placeholder={t('dashboard.budgetLabel')}
                    className="min-h-11 w-full rounded-[10px] border border-field bg-surface px-2.5 text-strong"
                  />
                  <p id="budget-hint" className="text-sm text-muted">
                    {t('hint.budget', { currency })}
                  </p>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1 text-sm">
                      {t('common.save')}
                    </Button>
                    <LinkButton
                      onClick={() => {
                        setEditingBudget(false)
                        setBudgetError(undefined)
                      }}
                    >
                      {t('common.cancel')}
                    </LinkButton>
                  </div>
                  {budgetError && (
                    <p className="text-sm text-danger" role="alert">
                      {budgetError}
                    </p>
                  )}
                </form>
              ) : (
                <LinkButton
                  className="self-start"
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
                </LinkButton>
              ))}
          </Card>
        ))}
      </section>

      {data.incomeCents > 0 && (
        <section className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3 nav:gap-4" aria-labelledby="dashboard-cashflow-title">
          <h2 id="dashboard-cashflow-title" className="sr-only">
            {t('dashboard.cashFlow')}
          </h2>
          {cashFlow.map((s) => (
            <Card key={s.id} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
              <p className="text-sm text-muted">{s.label}</p>
              <p className={`wrap-anywhere text-xl font-bold tracking-tight min-[420px]:text-2xl ${s.id !== 'income' && net < 0 ? 'text-danger' : 'text-strong'}`}>
                {s.value}
              </p>
              <p className="text-sm text-muted">{s.hint}</p>
            </Card>
          ))}
        </section>
      )}

      {data.overBudget.length > 0 && (
        <Card className="px-5 pt-2 pb-3" aria-labelledby="over-title">
          <h2 id="over-title" className="pt-3.5 pb-2 text-[17px] font-semibold text-strong">
            {t('dashboard.overBudget')}
          </h2>
          <ul className="m-0 list-none p-0">
            {data.overBudget.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-4 border-t border-line py-3">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-strong">
                  <Icon name={categoryIcon(c.name)} size={15} className="shrink-0 text-muted" />
                  <span className="wrap-anywhere">{categoryName(c.name)}</span>
                </span>
                <span className="shrink-0 text-sm text-danger tabular-nums">
                  {t('dashboard.overBy', { amount: formatMoney(c.spentCents - c.limitCents), limit: formatMoney(c.limitCents) })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

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
                  <span className="wrap-anywhere font-medium text-strong">{e.title}</span>
                  <span className="flex items-center gap-1 text-sm text-muted">
                    <Icon name={categoryIcon(e.category)} size={13} className="shrink-0" />
                    {categoryName(e.category)} · {formatDate(e.date)}
                  </span>
                  {e.description && (
                    <span className="wrap-anywhere text-sm text-muted">{e.description}</span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold text-strong tabular-nums">
                    {formatMoney(e.amountCents, e.currency)}
                  </span>
                  {ratesReady && e.currency !== currency && (
                    <span className="text-sm text-muted tabular-nums">
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
