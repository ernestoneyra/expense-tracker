import { useState } from 'react'
import { Card } from '../components/ui/Card.tsx'
import { ProgressBar, cardTitleClass } from '../components/ui/fields.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import type { MessageKey } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { useApi, type BudgetMethod, type Overview } from '../lib/api.ts'
import { EnvelopePanel } from './budgets/EnvelopePanel.tsx'
import { PayFirstPanel } from './budgets/PayFirstPanel.tsx'
import { SplitPanel } from './budgets/SplitPanel.tsx'
import { ZeroBasedPanel } from './budgets/ZeroBasedPanel.tsx'

const methods: { key: BudgetMethod; labelKey: MessageKey }[] = [
  { key: 'envelope', labelKey: 'budgets.envelope' },
  { key: 'split', labelKey: 'budgets.split' },
  { key: 'zeroBased', labelKey: 'budgets.zeroBased' },
  { key: 'payFirst', labelKey: 'budgets.payFirst' },
]

export function Budgets() {
  const { t, currency, formatMoney, formatMonth, formatPercent, categoryName } = usePreferences()
  const { data, error, loading, reload } = useApi<Overview>(`/budget/overview?currency=${currency}`)
  // Which method's panel is open; until one is picked it follows the saved (active) method.
  const [picked, setPicked] = useState<BudgetMethod>()

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (error || !data) {
    return (
      <p className="text-muted" role="alert">
        {t('budgets.loadError', { error: error ?? t('dashboard.noData') })}
      </p>
    )
  }

  const view = picked ?? data.method
  const left = data.incomeCents - data.spentCents
  const spentWhere = (type: 'fixed' | 'variable' | null) =>
    data.categories.filter((c) => c.costType === type).reduce((sum, c) => sum + c.spentCents, 0)
  const costSplit = [
    { id: 'fixed', label: t('categories.fixed'), cents: spentWhere('fixed') },
    { id: 'variable', label: t('categories.variable'), cents: spentWhere('variable') },
    { id: 'unclassified', label: t('budgets.unclassifiedLabel'), cents: spentWhere(null) },
  ]
  const overBudget = data.monthlyCents > 0 && data.spentCents > data.monthlyCents
  const projectedOver = data.monthlyCents > 0 && (data.projectedSpentCents ?? 0) > data.monthlyCents
  const props = { data, reload }

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('budgets.title')} subtitle={t('budgets.subtitle')} />

      <section className="grid grid-cols-2 gap-3 nav:grid-cols-4 nav:gap-4" aria-label={formatMonth(data.month)}>
        {[
          { id: 'income', label: t('budgets.income'), value: formatMoney(data.incomeCents), hint: formatMonth(data.month) },
          {
            id: 'spent',
            label: t('dashboard.spent'),
            value: formatMoney(data.spentCents),
            hint: data.incomeCents > 0 ? t('budgets.ofIncome', { share: formatPercent(data.spentCents / data.incomeCents) }) : t('budgets.needIncomeShort'),
          },
          {
            id: 'left',
            label: t('budgets.incomeLeft'),
            value: formatMoney(left),
            hint: left < 0 ? t('budgets.spendingMore') : t('budgets.incomeLeftHint'),
          },
          {
            id: 'pace',
            label: t('budgets.pace'),
            value: data.projectedSpentCents === null ? '—' : formatMoney(data.projectedSpentCents),
            hint: t('budgets.dayOf', { day: data.daysElapsed, days: data.daysInMonth }),
          },
        ].map((s) => (
          <Card key={s.id} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="truncate text-xl font-bold tracking-tight text-strong min-[420px]:text-2xl">{s.value}</p>
            <p className="text-[13px] text-muted">{s.hint}</p>
          </Card>
        ))}
      </section>

      {data.monthlyCents > 0 && (
        <Card className="flex flex-col gap-2 p-4 nav:p-5" aria-labelledby="overall-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="overall-title" className={cardTitleClass}>
              {t('dashboard.budgetLabel')}
            </h2>
            <span className="text-sm text-muted tabular-nums">
              {formatMoney(data.spentCents)} / {formatMoney(data.monthlyCents)}
            </span>
          </div>
          <ProgressBar ratio={data.spentCents / data.monthlyCents} over={overBudget} label={t('dashboard.budgetLabel')} />
          <p className={`text-sm ${overBudget || projectedOver ? 'text-red-500' : 'text-muted'}`}>
            {overBudget
              ? t('budgets.overall.over', { amount: formatMoney(data.spentCents - data.monthlyCents) })
              : projectedOver
                ? t('budgets.overall.pace', { amount: formatMoney(data.projectedSpentCents! - data.monthlyCents) })
                : t('budgets.overall.ok', { amount: formatMoney(data.monthlyCents - data.spentCents) })}
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-4 nav:p-5" aria-label={t('budgets.methods')}>
        <div role="group" aria-label={t('budgets.methods')} className="flex flex-wrap gap-1">
          {methods.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={view === m.key}
              onClick={() => setPicked(m.key)}
              className={`min-h-9 cursor-pointer rounded-[10px] px-3 text-sm font-medium ${
                view === m.key ? 'bg-accent-soft text-accent-text' : 'text-body hover:bg-hover hover:text-strong'
              }`}
            >
              {t(m.labelKey)}
              {data.method === m.key && ' ✓'}
            </button>
          ))}
        </div>
        {view === 'envelope' ? (
          <EnvelopePanel {...props} />
        ) : view === 'split' ? (
          <SplitPanel {...props} />
        ) : view === 'zeroBased' ? (
          <ZeroBasedPanel {...props} />
        ) : (
          <PayFirstPanel {...props} />
        )}
      </Card>

      <Card className="px-5 pt-2 pb-4" aria-labelledby="cost-title">
        <h2 id="cost-title" className={`pt-3.5 pb-1 ${cardTitleClass}`}>
          {t('budgets.fixedVariable')}
        </h2>
        <p className="pb-2 text-sm text-muted">{t('budgets.fixedVariableText')}</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {costSplit.map((row) => (
            <li key={row.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body">{row.label}</span>
                <span className="text-sm text-muted tabular-nums">
                  <span className="font-semibold text-strong">{formatMoney(row.cents)}</span>
                  {data.spentCents > 0 && ` · ${formatPercent(row.cents / data.spentCents)}`}
                </span>
              </div>
              <ProgressBar ratio={data.spentCents > 0 ? row.cents / data.spentCents : 0} label={row.label} />
            </li>
          ))}
        </ul>
        {costSplit[2].cents > 0 && (
          <p className="pt-3 text-sm text-muted">
            {t('budgets.classifyHint', {
              names: data.categories
                .filter((c) => c.costType === null && c.spentCents > 0)
                .map((c) => categoryName(c.name))
                .join(', '),
            })}
          </p>
        )}
      </Card>
    </div>
  )
}
