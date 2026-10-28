import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { Field, inputClass } from '../../components/ui/fields.tsx'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import type { Overview } from '../../lib/api.ts'
import { saveMethod, type PanelProps } from './methods.ts'
import { PanelHeader, TargetRow } from './shared.tsx'

// Pay yourself first: the savings share comes off income before anything else, and the rest is
// what there is to spend.
export function PayFirstPanel({ data, reload }: PanelProps & { data: Overview }) {
  const { t, formatMoney } = usePreferences()
  const [savings, setSavings] = useState(data.savingsPercent === null ? '' : String(data.savingsPercent))
  const [error, setError] = useState<string>()

  const percent = Number(savings)
  const valid = savings !== '' && Number.isFinite(percent) && percent >= 0 && percent <= 100

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await saveMethod({ method: 'payFirst', savingsPercent: percent })
      setError(undefined)
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const hasIncome = data.incomeCents > 0
  const savingsTarget = valid ? Math.round((data.incomeCents * percent) / 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title={t('budgets.payFirst')}
        description={t('budgets.payFirstText')}
        active={data.method === 'payFirst'}
      />

      <form onSubmit={save} className="grid gap-3 min-[560px]:grid-cols-[1fr_auto] min-[560px]:items-end">
        <Field label={t('budgets.savingsShare')}>
          <div className="relative">
            <input
              required
              type="number"
              min="0"
              max="100"
              step="any"
              inputMode="decimal"
              value={savings}
              onChange={(e) => setSavings(e.target.value)}
              className={`${inputClass} pr-8`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">%</span>
          </div>
        </Field>
        <Button type="submit" disabled={!valid}>
          {data.method === 'payFirst' ? t('common.save') : t('budgets.useMethod')}
        </Button>
      </form>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {!hasIncome ? (
        <p className="text-sm text-muted">{t('budgets.needIncome')}</p>
      ) : valid ? (
        <ul className="m-0 list-none p-0">
          <li>
            <TargetRow
              label={t('budgets.setAside')}
              actual={data.savedCents + data.debtPaidCents}
              target={savingsTarget}
              goal
              detail={t('budgets.savingsBreakdown', {
                saved: formatMoney(data.savedCents),
                debt: formatMoney(data.debtPaidCents),
              })}
            />
          </li>
          <li>
            <TargetRow
              label={t('budgets.toSpend')}
              actual={data.spentCents}
              target={Math.max(0, data.incomeCents - savingsTarget)}
            />
          </li>
        </ul>
      ) : null}
    </div>
  )
}
