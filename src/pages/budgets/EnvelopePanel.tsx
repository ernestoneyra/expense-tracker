import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../../components/ui/Button.tsx'
import { AmountField, Field, emptyRowClass, inputClass } from '../../components/ui/fields.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { categoryIcon } from '../../config/categoryIcons.ts'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import { api, useApi, type Category, type CategoryLimit, type Overview } from '../../lib/api.ts'
import { fromCents, toCents } from '../../lib/money.ts'
import { saveMethod, type PanelProps } from './methods.ts'
import { PanelHeader, TargetRow } from './shared.tsx'

// Envelope budgeting: every category gets its own monthly limit.
export function EnvelopePanel({ data, reload }: PanelProps & { data: Overview }) {
  const { t, currency, categoryName, formatMoney } = usePreferences()
  const { data: categories } = useApi<Category[]>('/categories')
  const { data: limits, reload: reloadLimits } = useApi<CategoryLimit[]>('/budget/categories')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string>()

  const refresh = () => {
    reloadLimits()
    reload()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api('/budget/categories', {
        method: 'PUT',
        body: JSON.stringify({ category, limitCents: toCents(amount), currency }),
      })
      setCategory('')
      setAmount('')
      setError(undefined)
      refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const remove = async (id: string) => {
    try {
      await api(`/budget/categories/${id}`, { method: 'DELETE' })
      setError(undefined)
      refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const limitId = (name: string) => limits?.find((l) => l.category === name)?.id
  const byOverage = (a: { spentCents: number; limitCents: number | null }, b: typeof a) =>
    b.spentCents - (b.limitCents ?? 0) - (a.spentCents - (a.limitCents ?? 0))
  const withLimit = data.categories.filter((c) => c.limitCents !== null).sort(byOverage)
  const withoutLimit = data.categories.filter((c) => c.limitCents === null && c.spentCents > 0).sort((a, b) => b.spentCents - a.spentCents)

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title={t('budgets.envelope')}
        description={t('budgets.envelopeText')}
        active={data.method === 'envelope'}
        onActivate={async () => {
          await saveMethod({ method: 'envelope' })
          reload()
        }}
      />

      <form onSubmit={submit} className="grid gap-3 min-[560px]:grid-cols-[1fr_1fr_auto] min-[560px]:items-end">
        <Field label={t('expenses.category')}>
          <select required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="" disabled>
              {t('expenses.selectCategory')}
            </option>
            {categories?.map((c) => (
              <option key={c.id} value={c.name}>
                {categoryName(c.name)}
              </option>
            ))}
          </select>
        </Field>
        <AmountField label={t('budgets.monthlyLimit')} amount={amount} onAmount={setAmount} currency={currency} />
        <Button type="submit">
          <Icon name="plus" size={18} />
          {t('budgets.setLimit')}
        </Button>
      </form>
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {data.monthlyCents > 0 && data.plan.limitsCents > data.monthlyCents && (
        <p className="text-sm text-red-500" role="alert">
          {t('budgets.limitsOverBudget', {
            limits: formatMoney(data.plan.limitsCents),
            budget: formatMoney(data.monthlyCents),
          })}
        </p>
      )}

      {withLimit.length === 0 && withoutLimit.length === 0 ? (
        <p className={emptyRowClass}>{t('budgets.noLimits')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {[...withLimit, ...withoutLimit].map((c) => (
            <li key={c.name} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <TargetRow
                  label={
                    <span className="flex items-center gap-2">
                      <Icon name={categoryIcon(c.name)} size={16} className="shrink-0 text-muted" />
                      <span className="truncate">{categoryName(c.name)}</span>
                    </span>
                  }
                  actual={c.spentCents}
                  target={c.limitCents}
                  detail={c.limitCents === null ? t('budgets.noLimit') : undefined}
                />
              </div>
              {c.limitCents !== null && (
                <div className="flex border-t border-line pt-1.5">
                  <IconButton
                    onClick={() => {
                      setCategory(c.name)
                      setAmount(fromCents(c.limitCents!, currency))
                    }}
                    aria-label={t('budgets.editLimit', { name: categoryName(c.name) })}
                  >
                    <Icon name="edit" size={18} />
                  </IconButton>
                  {limitId(c.name) && (
                    <IconButton
                      onClick={() => remove(limitId(c.name)!)}
                      aria-label={t('budgets.removeLimit', { name: categoryName(c.name) })}
                    >
                      <Icon name="close" size={18} />
                    </IconButton>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
