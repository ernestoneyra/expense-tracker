import { useState } from 'react'
import { ChipButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { ProgressBar, cardTitleClass, emptyRowClass } from '../components/ui/fields.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { categoryIcon } from '../config/categoryIcons.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { useApi, type Report } from '../lib/api.ts'

const RANGES = [3, 6, 12]

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

export function Reports() {
  const { t, currency, formatMoney, formatMonth, formatPercent, categoryName } = usePreferences()
  const [months, setMonths] = useState(6)
  const { data, error, loading } = useApi<Report>(`/reports?months=${months}&currency=${currency}`)

  const rangePicker = (
    <div role="group" aria-label={t('reports.range')} className="flex gap-1">
      {RANGES.map((n) => (
        <ChipButton key={n} pressed={months === n} onClick={() => setMonths(n)}>
          {t('reports.months', { count: n })}
        </ChipButton>
      ))}
    </div>
  )

  // The heading is there while loading or after an error, so the page always has one.
  if (loading || error || !data) {
    return (
      <div className="flex max-w-275 flex-col gap-6">
        <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} glossary />
        {rangePicker}
        {loading ? (
          <p className="text-muted" role="status">
            {t('common.loading')}
          </p>
        ) : (
          <p className="text-muted" role="alert">
            {t('reports.loadError', { error: error ?? t('dashboard.noData') })}
          </p>
        )}
      </div>
    )
  }

  const income = sum(data.incomeCents)
  const spent = sum(data.spentCents)
  const net = income - spent
  const peak = Math.max(1, ...data.incomeCents, ...data.spentCents)
  const last = data.months.length - 1
  const stats = [
    { id: 'income', label: t('reports.totalIncome'), value: formatMoney(income) },
    { id: 'spent', label: t('reports.totalSpent'), value: formatMoney(spent) },
    { id: 'net', label: t('reports.net'), value: formatMoney(net) },
    {
      id: 'rate',
      label: t('reports.savingsRate'),
      value: income > 0 ? formatPercent(net / income) : '—',
    },
  ]

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} glossary />
      {rangePicker}

      <section className="grid grid-cols-2 gap-3 nav:grid-cols-4 nav:gap-4" aria-labelledby="reports-totals-title">
        <h2 id="reports-totals-title" className="sr-only">
          {t('reports.totals')}
        </h2>
        {stats.map((s) => (
          <Card key={s.id} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`wrap-anywhere text-xl font-bold tracking-tight min-[420px]:text-2xl ${s.id === 'net' && net < 0 ? 'text-danger' : 'text-strong'}`}>
              {s.value}
            </p>
            <p className="text-sm text-muted">{t('reports.lastMonths', { count: data.months.length })}</p>
          </Card>
        ))}
      </section>

      <Card className="px-5 pt-2 pb-4" aria-labelledby="flow-title">
        <h2 id="flow-title" className={`pt-3.5 pb-2 ${cardTitleClass}`}>
          {t('reports.cashFlow')}
        </h2>
        <ul className="m-0 list-none p-0">
          {data.months.map((m, i) => {
            const monthNet = data.incomeCents[i] - data.spentCents[i]
            const overBudget = data.budgetCents > 0 && data.spentCents[i] > data.budgetCents
            return (
              <li key={m} className="flex flex-col gap-1.5 border-t border-line py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium text-strong">{formatMonth(m)}</span>
                  <span className={`text-sm tabular-nums ${monthNet < 0 ? 'text-danger' : 'text-muted'}`}>
                    {t('reports.netOf', { amount: formatMoney(monthNet) })}
                    {data.incomeCents[i] > 0 && ` · ${t('reports.rateOf', { rate: formatPercent(monthNet / data.incomeCents[i]) })}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-muted">{t('reports.income')}</span>
                  <div className="flex-1">
                    <ProgressBar ratio={data.incomeCents[i] / peak} label={`${formatMonth(m)} ${t('reports.income')}`} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm text-strong tabular-nums">{formatMoney(data.incomeCents[i])}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm text-muted">{t('reports.spent')}</span>
                  <div className="flex-1">
                    <ProgressBar ratio={data.spentCents[i] / peak} over={data.spentCents[i] > data.incomeCents[i]} label={`${formatMonth(m)} ${t('reports.spent')}`} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm text-strong tabular-nums">{formatMoney(data.spentCents[i])}</span>
                </div>
                {overBudget && (
                  <span className="text-sm text-danger">
                    {t('reports.overBudget', { amount: formatMoney(data.spentCents[i] - data.budgetCents) })}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {data.budgetCents > 0 && <p className="pt-2 text-sm text-muted">{t('reports.budgetNote')}</p>}
      </Card>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="cats-title">
        <h2 id="cats-title" className={`pt-3.5 pb-2 ${cardTitleClass}`}>
          {t('reports.byCategory')}
        </h2>
        {data.categories.length === 0 ? (
          <p className={emptyRowClass}>{t('reports.empty')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.categories.map((c) => {
              const total = sum(c.cents)
              const now = c.cents[last]
              const before = last > 0 ? c.cents[last - 1] : 0
              const change = before > 0 ? (now - before) / before : null
              return (
                <li key={c.name} className="flex flex-col gap-1.5 border-t border-line py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-strong">
                      <Icon name={categoryIcon(c.name)} size={16} className="shrink-0 text-muted" />
                      <span className="wrap-anywhere">{categoryName(c.name)}</span>
                    </span>
                    <span className="shrink-0 text-sm text-muted tabular-nums">
                      <span className="font-semibold text-strong">{formatMoney(total)}</span>
                      {spent > 0 && ` · ${formatPercent(total / spent)}`}
                    </span>
                  </div>
                  <ProgressBar ratio={spent > 0 ? total / spent : 0} label={categoryName(c.name)} />
                  <span className="text-sm text-muted tabular-nums">
                    {t('reports.average', { amount: formatMoney(Math.round(total / data.months.length)) })}
                    {change !== null &&
                      ` · ${t('reports.vsPrevious', { change: `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%` })}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
