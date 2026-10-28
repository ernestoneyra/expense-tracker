import { usePreferences } from '../../i18n/PreferencesContext.ts'
import type { Overview } from '../../lib/api.ts'
import { saveMethod, type PanelProps } from './methods.ts'
import { PanelHeader } from './shared.tsx'

// Zero-based budgeting: income minus everything planned should leave nothing unassigned.
export function ZeroBasedPanel({ data, reload }: PanelProps & { data: Overview }) {
  const { t, formatMoney } = usePreferences()
  const { limitsCents, goalsCents, debtMinimumsCents, sinkingFundCents } = data.plan
  const lines = [
    { id: 'limits', label: t('budgets.lineLimits'), cents: limitsCents },
    { id: 'goals', label: t('budgets.lineGoals'), cents: goalsCents },
    { id: 'debts', label: t('budgets.lineDebts'), cents: debtMinimumsCents },
    { id: 'sinking', label: t('budgets.lineSinking'), cents: sinkingFundCents },
  ]
  const assigned = lines.reduce((sum, l) => sum + l.cents, 0)
  const unassigned = data.incomeCents - assigned

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title={t('budgets.zeroBased')}
        description={t('budgets.zeroBasedText')}
        active={data.method === 'zeroBased'}
        onActivate={async () => {
          await saveMethod({ method: 'zeroBased' })
          reload()
        }}
      />

      {data.incomeCents === 0 && <p className="text-sm text-muted">{t('budgets.needIncome')}</p>}
      <ul className="m-0 list-none p-0">
        <li className="flex items-baseline justify-between gap-3 border-t border-line py-3">
          <span className="font-medium text-strong">{t('budgets.lineIncome')}</span>
          <span className="font-semibold text-strong tabular-nums">{formatMoney(data.incomeCents)}</span>
        </li>
        {lines.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 border-t border-line py-3">
            <span className="text-body">{l.label}</span>
            <span className="text-body tabular-nums">−{formatMoney(l.cents)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-line py-3">
          <span className="font-semibold text-strong">{t('budgets.lineUnassigned')}</span>
          <span
            className={`text-lg font-bold tabular-nums ${Math.abs(unassigned) < 1 ? 'text-accent-text' : unassigned < 0 ? 'text-red-500' : 'text-strong'}`}
          >
            {formatMoney(unassigned)}
          </span>
        </li>
      </ul>
      <p className={`text-sm ${unassigned < -1 ? 'text-red-500' : 'text-muted'}`}>
        {Math.abs(unassigned) < 1
          ? t('budgets.zeroDone')
          : unassigned > 0
            ? t('budgets.zeroUnassigned', { amount: formatMoney(unassigned) })
            : t('budgets.zeroOver', { amount: formatMoney(-unassigned) })}
      </p>
    </div>
  )
}
