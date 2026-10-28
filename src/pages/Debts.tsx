import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { ConfirmToast } from '../components/ui/ConfirmToast.tsx'
import { AmountField, Field, ProgressBar, cardTitleClass, emptyRowClass, inputClass } from '../components/ui/fields.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { amountStepFor } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Debt, type DebtsResponse, type PayoffPlan } from '../lib/api.ts'
import { fromCents, toCents, today } from '../lib/money.ts'

type Strategy = 'avalanche' | 'snowball'

export function Debts() {
  const { t, formatMoney, currency } = usePreferences()
  // The extra monthly payment is applied (and sent to the server) when its form is submitted.
  const [extra, setExtra] = useState('')
  const [appliedExtra, setAppliedExtra] = useState(0)
  const [strategy, setStrategy] = useState<Strategy>('avalanche')
  const { data, error, loading, reload } = useApi<DebtsResponse>(`/debts?currency=${currency}&extra=${appliedExtra}`)

  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [debtCurrency, setDebtCurrency] = useState(currency)
  const [apr, setApr] = useState('')
  const [minimum, setMinimum] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<Debt>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api('/debts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          currency: debtCurrency,
          balanceCents: toCents(balance),
          aprPercent: Number(apr),
          minPaymentCents: toCents(minimum),
        }),
      })
      setName('')
      setBalance('')
      setApr('')
      setMinimum('')
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (debt: Debt) => {
    setPendingDelete(undefined)
    try {
      await api(`/debts/${debt.id}`, { method: 'DELETE' })
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const applyExtra = (e: FormEvent) => {
    e.preventDefault()
    setAppliedExtra(Math.max(0, toCents(extra || '0')))
  }

  const planLine = (plan: PayoffPlan) =>
    plan.months === null
      ? t('debts.neverPaid')
      : t('debts.debtFreeIn', { count: plan.months, interest: formatMoney(plan.interestCents ?? 0) })

  const open = data?.debts.filter((d) => d.balanceCents > 0) ?? []
  const saves =
    data && data.plan.avalanche.interestCents !== null && data.plan.snowball.interestCents !== null
      ? data.plan.snowball.interestCents - data.plan.avalanche.interestCents
      : null
  const chosen = data?.plan[strategy]
  const monthOf = (id: string) => chosen?.order.find((o) => o.id === id)?.month ?? null

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('debts.title')} subtitle={t('debts.subtitle')} />

      <Card className="p-4 nav:p-5" aria-labelledby="add-debt-title">
        <h2 id="add-debt-title" className={`pb-3 ${cardTitleClass}`}>
          {t('debts.new')}
        </h2>
        <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-2 nav:grid-cols-4">
          <Field label={t('debts.name')}>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('debts.namePlaceholder')}
              className={inputClass}
            />
          </Field>
          <AmountField
            label={t('debts.balance')}
            amount={balance}
            onAmount={setBalance}
            currency={debtCurrency}
            onCurrency={setDebtCurrency}
          />
          <Field label={t('debts.apr')}>
            <div className="relative">
              <input
                required
                type="number"
                min="0"
                max="100"
                step="any"
                inputMode="decimal"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                className={`${inputClass} pr-8`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">%</span>
            </div>
          </Field>
          <AmountField label={t('debts.minimum')} amount={minimum} onAmount={setMinimum} currency={debtCurrency} />
          <div className="flex items-center gap-3 min-[560px]:col-span-2 nav:col-span-4">
            <Button type="submit" disabled={submitting}>
              <Icon name="plus" size={18} />
              {t('debts.add')}
            </Button>
            {formError && (
              <p className="text-sm text-red-500" role="alert">
                {formError}
              </p>
            )}
          </div>
        </form>
      </Card>

      {open.length > 0 && data && (
        <Card className="flex flex-col gap-4 p-4 nav:p-5" aria-labelledby="plan-title">
          <div className="flex flex-col gap-1">
            <h2 id="plan-title" className={cardTitleClass}>
              {t('debts.plan')}
            </h2>
            <p className="text-sm text-muted">{t('debts.planText')}</p>
          </div>
          <form onSubmit={applyExtra} className="flex flex-wrap items-end gap-3">
            <Field label={t('debts.extra', { currency })} className="w-full min-[420px]:w-56">
              <input
                type="number"
                min="0"
                step={amountStepFor(currency)}
                inputMode="decimal"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={t('debts.extraPlaceholder')}
                className={inputClass}
              />
            </Field>
            <Button type="submit">{t('debts.updatePlan')}</Button>
          </form>
          <div className="grid gap-3 min-[560px]:grid-cols-2">
            {(['avalanche', 'snowball'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={strategy === s}
                onClick={() => setStrategy(s)}
                className={`flex cursor-pointer flex-col gap-1 rounded-[12px] border p-3.5 text-left ${
                  strategy === s ? 'border-accent bg-accent-soft' : 'border-line hover:bg-hover'
                }`}
              >
                <span className="font-semibold text-strong">{t(`debts.${s}`)}</span>
                <span className="text-[13px] text-muted">{t(`debts.${s}Text`)}</span>
                <span className="text-sm text-body">{planLine(data.plan[s])}</span>
              </button>
            ))}
          </div>
          {saves !== null && saves !== 0 && (
            <p className="text-sm font-medium text-accent-text">
              {saves > 0
                ? t('debts.avalancheSaves', { amount: formatMoney(saves) })
                : t('debts.snowballSaves', { amount: formatMoney(-saves) })}
            </p>
          )}
        </Card>
      )}

      <Card className="px-5 pt-2 pb-3" aria-labelledby="all-debts-title">
        <h2 id="all-debts-title" className={`pt-3.5 pb-2 ${cardTitleClass}`}>
          {t('debts.all')}
        </h2>
        {loading ? (
          <p className={emptyRowClass}>{t('common.loading')}</p>
        ) : error || !data ? (
          <p className={emptyRowClass} role="alert">
            {t('debts.loadError', { error: error ?? '' })}
          </p>
        ) : data.debts.length === 0 ? (
          <p className={emptyRowClass}>{t('debts.empty')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.debts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                payoffMonth={monthOf(debt.id)}
                onChange={reload}
                onDelete={() => setPendingDelete(debt)}
              />
            ))}
          </ul>
        )}
      </Card>

      {pendingDelete && (
        <ConfirmToast
          title={t('debts.confirmTitle', { name: pendingDelete.name })}
          confirmLabel={t('common.delete')}
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(undefined)}
        >
          {t('debts.confirmBody')}
        </ConfirmToast>
      )}
    </div>
  )
}

function DebtRow({
  debt,
  payoffMonth,
  onChange,
  onDelete,
}: {
  debt: Debt
  payoffMonth: number | null
  onChange: () => void
  onDelete: () => void
}) {
  const { t, formatMoney, formatIn, formatDate, formatPercent } = usePreferences()
  const [payment, setPayment] = useState('')
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState(false)
  // The editor works in the debt's own currency, the one it is stored in.
  const [balance, setBalance] = useState('')
  const [apr, setApr] = useState('')
  const [minimum, setMinimum] = useState('')
  const [error, setError] = useState<string>()

  const paidShare = debt.startingBalanceCents > 0 ? 1 - debt.balanceCents / debt.startingBalanceCents : 0
  const cleared = debt.balanceCents === 0

  const run = async (path: string, init: RequestInit, after?: () => void) => {
    try {
      await api(path, init)
      setError(undefined)
      after?.()
      onChange()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const pay = (e: FormEvent) => {
    e.preventDefault()
    void run(
      `/debts/${debt.id}/payments`,
      { method: 'POST', body: JSON.stringify({ amountCents: toCents(payment), date }) },
      () => setPayment(''),
    )
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    void run(
      `/debts/${debt.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ balanceCents: toCents(balance), aprPercent: Number(apr), minPaymentCents: toCents(minimum) }),
      },
      () => setEditing(false),
    )
  }

  return (
    <li className="flex flex-col gap-3 border-t border-line py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-strong">{debt.name}</span>
          <span className="text-[13px] text-muted">
            {t('debts.rate', { apr: debt.aprPercent })} · {t('debts.minPayment', { amount: formatMoney(debt.minPaymentCents) })}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex flex-col items-end">
            <span className="font-semibold text-strong tabular-nums">{formatMoney(debt.balanceCents)}</span>
            <span className="text-[13px] text-muted">{t('debts.owed')}</span>
          </div>
          <IconButton
            onClick={() => {
              setBalance(fromCents(debt.ownBalanceCents, debt.currency))
              setApr(String(debt.aprPercent))
              setMinimum(fromCents(debt.ownMinPaymentCents, debt.currency))
              setEditing((v) => !v)
            }}
            aria-label={t('debts.editLabel', { name: debt.name })}
          >
            <Icon name="edit" size={18} />
          </IconButton>
          <IconButton onClick={onDelete} aria-label={t('debts.deleteLabel', { name: debt.name })}>
            <Icon name="close" size={18} />
          </IconButton>
        </div>
      </div>

      <ProgressBar ratio={paidShare} label={debt.name} />
      <p className="text-[13px] text-muted">
        {cleared
          ? t('debts.cleared')
          : `${t('debts.paidOff', { share: formatPercent(paidShare) })}${payoffMonth === null ? '' : ` · ${t('debts.clearsIn', { count: payoffMonth })}`}`}
        {debt.paidThisMonthCents > 0 && ` · ${t('debts.paidThisMonth', { amount: formatMoney(debt.paidThisMonthCents) })}`}
      </p>

      {editing && (
        <form onSubmit={save} className="grid gap-3 min-[560px]:grid-cols-4 min-[560px]:items-end">
          <AmountField label={t('debts.balance')} amount={balance} onAmount={setBalance} currency={debt.currency} required={false} />
          <Field label={t('debts.apr')}>
            <input
              required
              type="number"
              min="0"
              max="100"
              step="any"
              value={apr}
              onChange={(e) => setApr(e.target.value)}
              className={inputClass}
            />
          </Field>
          <AmountField label={t('debts.minimum')} amount={minimum} onAmount={setMinimum} currency={debt.currency} required={false} />
          <Button type="submit">{t('common.save')}</Button>
        </form>
      )}

      {!cleared && (
        <form onSubmit={pay} className="flex flex-wrap items-end gap-2">
          <div className="w-full min-[420px]:w-56">
            <AmountField label={t('debts.payment')} amount={payment} onAmount={setPayment} currency={debt.currency} />
          </div>
          <Field label={t('expenses.date')}>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" className="min-h-10">
            {t('debts.recordPayment')}
          </Button>
        </form>
      )}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {debt.payments.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-strong">
            {t('debts.history', { count: debt.payments.length })}
          </summary>
          <ul className="m-0 mt-2 list-none p-0">
            {debt.payments.slice(0, 20).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 border-t border-line py-1.5">
                <span className="text-muted">{formatDate(p.date)}</span>
                <span className="text-strong tabular-nums">{formatIn(p.amountCents, debt.currency)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
