import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Field, inputClass } from '../../components/ui/fields.tsx'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import type { Overview } from '../../lib/api.ts'
import { saveMethod, type PanelProps } from './methods.ts'
import { PanelHeader, TargetRow } from './shared.tsx'

// The split the "50/30/20" rule is named for. It only pre-fills the form until the user saves their own.
const STANDARD_SPLIT = { needs: 50, wants: 30, savings: 20 }

// Income is shared between needs, wants and savings by percentage. Savings includes money put into
// goals and paid toward debts this month.
export function SplitPanel({ data, reload }: PanelProps & { data: Overview }) {
  const { t, formatMoney } = usePreferences()
  const [needs, setNeeds] = useState(String(data.needsPercent ?? STANDARD_SPLIT.needs))
  const [wants, setWants] = useState(String(data.wantsPercent ?? STANDARD_SPLIT.wants))
  const [savings, setSavings] = useState(String(data.savingsPercent ?? STANDARD_SPLIT.savings))
  const [error, setError] = useState<string>()

  const total = Number(needs) + Number(wants) + Number(savings)
  const valid = [needs, wants, savings].every((v) => v !== '' && Number.isFinite(Number(v))) && Math.abs(total - 100) < 0.001

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await saveMethod({
        method: 'split',
        needsPercent: Number(needs),
        wantsPercent: Number(wants),
        savingsPercent: Number(savings),
      })
      setError(undefined)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const spentWhere = (necessity: 'need' | 'want' | null) =>
    data.categories.filter((c) => c.necessity === necessity).reduce((sum, c) => sum + c.spentCents, 0)
  const unclassified = spentWhere(null)
  const target = (percent: string) => (data.incomeCents > 0 ? Math.round((data.incomeCents * Number(percent)) / 100) : null)

  const percentField = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      <div className="relative">
        <input
          required
          type="number"
          min="0"
          max="100"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => set(e.target.value)}
          className={`${inputClass} pr-8`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">%</span>
      </div>
    </Field>
  )

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title={t('budgets.split')}
        description={t('budgets.splitText')}
        active={data.method === 'split'}
      />

      <form onSubmit={save} className="grid gap-3 min-[560px]:grid-cols-[1fr_1fr_1fr_auto] min-[560px]:items-end">
        {percentField(t('budgets.needs'), needs, setNeeds)}
        {percentField(t('budgets.wants'), wants, setWants)}
        {percentField(t('budgets.savings'), savings, setSavings)}
        <Button type="submit" disabled={!valid}>
          {data.method === 'split' ? t('common.save') : t('budgets.useMethod')}
        </Button>
      </form>
      <p className={`text-sm ${valid ? 'text-muted' : 'text-red-500'}`} role={valid ? undefined : 'alert'}>
        {t('budgets.percentTotal', { total: Number.isFinite(total) ? Math.round(total * 100) / 100 : 0 })}
      </p>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {data.incomeCents === 0 ? (
        <p className="text-sm text-muted">{t('budgets.needIncome')}</p>
      ) : (
        <p className="text-sm text-muted">{t('budgets.incomeBasis', { amount: formatMoney(data.incomeCents) })}</p>
      )}
      <ul className="m-0 list-none p-0">
        <li>
          <TargetRow label={t('budgets.needs')} actual={spentWhere('need')} target={target(needs)} />
        </li>
        <li>
          <TargetRow label={t('budgets.wants')} actual={spentWhere('want')} target={target(wants)} />
        </li>
        <li>
          <TargetRow
            label={t('budgets.savingsAndDebt')}
            actual={data.savedCents + data.debtPaidCents}
            target={target(savings)}
            goal
            detail={t('budgets.savingsBreakdown', {
              saved: formatMoney(data.savedCents),
              debt: formatMoney(data.debtPaidCents),
            })}
          />
        </li>
      </ul>
      {unclassified > 0 && (
        <p className="text-sm text-muted">{t('budgets.unclassified', { amount: formatMoney(unclassified) })}</p>
      )}
    </div>
  )
}
