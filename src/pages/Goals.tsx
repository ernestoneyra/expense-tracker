import { useState, type FormEvent } from 'react'
import { Button, IconButton, SecondaryButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { ConfirmToast } from '../components/ui/ConfirmToast.tsx'
import { AmountField, Field, ProgressBar, cardTitleClass, emptyRowClass, inputClass } from '../components/ui/fields.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { CURRENCIES, isCurrency } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Goal, type GoalsResponse } from '../lib/api.ts'
import { toCents, today } from '../lib/money.ts'

type Kind = 'savings' | 'emergency'

export function Goals() {
  const { t, formatMoney, formatIn, formatDate, formatPercent, currency, entryCurrency } = usePreferences()
  const { data, error, loading, reload } = useApi<GoalsResponse>(`/goals?currency=${currency}`)
  const [kind, setKind] = useState<Kind>('savings')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [targetCurrency, setTargetCurrency] = useState(entryCurrency)
  const [months, setMonths] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<Goal>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api('/goals', {
        method: 'POST',
        body: JSON.stringify({
          name,
          kind,
          currency: targetCurrency,
          targetCents: kind === 'savings' ? toCents(target) : undefined,
          targetMonths: kind === 'emergency' ? Number(months) : undefined,
          deadline: kind === 'savings' && deadline ? deadline : undefined,
        }),
      })
      setName('')
      setTarget('')
      setMonths('')
      setDeadline('')
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (goal: Goal) => {
    setPendingDelete(undefined)
    try {
      await api(`/goals/${goal.id}`, { method: 'DELETE' })
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('goals.title')} subtitle={t('goals.subtitle')} glossary />

      <Card className="p-4 nav:p-5" aria-labelledby="add-goal-title">
        <h2 id="add-goal-title" className={`pb-3 ${cardTitleClass}`}>
          {t('goals.new')}
        </h2>
        <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-2 nav:grid-cols-4">
          <Field label={t('goals.kind')}>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={inputClass}>
              <option value="savings">{t('goals.savings')}</option>
              <option value="emergency">{t('goals.emergency')}</option>
            </select>
          </Field>
          <Field label={t('goals.name')} hint={t('hint.goalName')}>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(kind === 'savings' ? 'goals.namePlaceholder' : 'goals.emergencyPlaceholder')}
              className={inputClass}
            />
          </Field>
          {kind === 'savings' ? (
            <>
              <AmountField
                label={t('goals.target')}
                hint={t('hint.goalTarget')}
                amount={target}
                onAmount={setTarget}
                currency={targetCurrency}
                onCurrency={setTargetCurrency}
              />
              <Field label={t('goals.deadline')} hint={t('hint.deadline')}>
                <input type="date" min={today()} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
              </Field>
            </>
          ) : (
            <>
              <Field label={t('goals.months')} hint={t('hint.months')}>
                <input
                  required
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  inputMode="numeric"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={t('expenses.currency')}>
                <select
                  value={targetCurrency}
                  onChange={(e) => isCurrency(e.target.value) && setTargetCurrency(e.target.value)}
                  className={inputClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-4">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              {t('goals.add')}
            </Button>
            {formError && (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            )}
          </div>
        </form>
        {kind === 'emergency' && <p className="pt-3 text-sm text-muted">{t('goals.emergencyText')}</p>}
      </Card>

      {loading ? (
        <p className="text-muted" role="status">{t('common.loading')}</p>
      ) : error || !data ? (
        <p className="text-muted" role="alert">
          {t('goals.loadError', { error: error ?? '' })}
        </p>
      ) : data.goals.length === 0 ? (
        <Card className={`${emptyRowClass} border-0`}>{t('goals.empty')}</Card>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 nav:grid-cols-2">
          {data.goals.map((goal) => {
            const ratio = goal.targetCents ? goal.savedCents / goal.targetCents : 0
            return (
              <li key={goal.id}>
                <Card className="flex h-full flex-col gap-3 p-4 nav:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <h2 className={`wrap-anywhere ${cardTitleClass}`}>{goal.name}</h2>
                      <span className="text-sm text-muted">
                        {goal.kind === 'emergency'
                          ? t('goals.coversMonths', { count: goal.targetMonths ?? 0 })
                          : goal.deadline
                            ? t('goals.by', { date: formatDate(goal.deadline) })
                            : t('goals.noDeadline')}
                      </span>
                    </div>
                    <IconButton onClick={() => setPendingDelete(goal)} aria-label={t('goals.deleteLabel', { name: goal.name })}>
                      <Icon name="close" size={18} />
                    </IconButton>
                  </div>

                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-2xl font-bold tracking-tight text-strong tabular-nums">{formatMoney(goal.savedCents)}</span>
                    <span className="text-sm text-muted tabular-nums">
                      {goal.targetCents === null ? t('goals.noTarget') : `/ ${formatMoney(goal.targetCents)}`}
                    </span>
                  </div>
                  {goal.targetCents !== null && (
                    <>
                      <ProgressBar ratio={ratio} label={goal.name} />
                      <p className="text-sm text-muted">
                        {goal.remainingCents === 0
                          ? t('goals.done')
                          : t('goals.progress', { share: formatPercent(Math.min(1, ratio)), remaining: formatMoney(goal.remainingCents ?? 0) })}
                      </p>
                    </>
                  )}
                  {goal.kind === 'emergency' && (
                    <p className="text-sm text-muted">
                      {data.averageSpendCents === null
                        ? t('goals.noSpendingYet')
                        : t('goals.averageSpend', { amount: formatMoney(data.averageSpendCents) })}
                    </p>
                  )}
                  {goal.overdue && (
                    <p className="text-sm text-danger" role="alert">
                      {t('goals.overdue')}
                    </p>
                  )}
                  {goal.monthlyNeededCents !== null && goal.remainingCents !== 0 && (
                    <p className="text-sm font-medium text-accent-text">
                      {t('goals.monthlyNeeded', { amount: formatMoney(goal.monthlyNeededCents) })}
                    </p>
                  )}

                  <ContributionForm goal={goal} onDone={reload} />

                  {goal.contributions.length > 0 && (
                    <details className="text-sm">
                      <summary className="flex min-h-11 cursor-pointer items-center font-medium text-body hover:text-strong">
                        {t('goals.history', { count: goal.contributions.length })}
                      </summary>
                      <ul className="m-0 mt-2 list-none p-0">
                        {goal.contributions.slice(0, 20).map((c) => (
                          <li key={c.id} className="flex justify-between gap-3 border-t border-line py-1.5">
                            <span className="text-muted">{formatDate(c.date)}</span>
                            <span className={`tabular-nums ${c.amountCents < 0 ? 'text-danger' : 'text-strong'}`}>
                              {formatIn(c.amountCents, goal.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmToast
          title={t('goals.confirmTitle', { name: pendingDelete.name })}
          confirmLabel={t('common.delete')}
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(undefined)}
        >
          {t('goals.confirmBody')}
        </ConfirmToast>
      )}
    </div>
  )
}

/** Adds money to a goal or takes it out. Amounts are in the goal's own currency. */
function ContributionForm({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const { t } = usePreferences()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string>()

  const record = async (sign: 1 | -1) => {
    const cents = toCents(amount)
    if (!(cents > 0)) {
      setError(t('dashboard.invalidAmount'))
      return
    }
    try {
      await api(`/goals/${goal.id}/contributions`, {
        method: 'POST',
        body: JSON.stringify({ amountCents: sign * cents, date }),
      })
      setAmount('')
      setError(undefined)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void record(1)
      }}
      className="mt-auto flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <AmountField label={t('goals.amount')} amount={amount} onAmount={setAmount} currency={goal.currency} required={false} />
        <Field label={t('expenses.date')}>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="text-sm">
          {t('goals.deposit')}
        </Button>
        <SecondaryButton onClick={() => void record(-1)} className="text-sm">
          {t('goals.withdraw')}
        </SecondaryButton>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
