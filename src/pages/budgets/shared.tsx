import type { ReactNode } from 'react'
import { Button } from '../../components/ui/Button.tsx'
import { ProgressBar, cardTitleClass } from '../../components/ui/fields.tsx'
import { usePreferences } from '../../i18n/PreferencesContext.ts'

/** The panel heading with either an "active" badge or the button that makes this the active method. */
export function PanelHeader({
  title,
  description,
  active,
  onActivate,
}: {
  title: string
  description: string
  active: boolean
  /** Omitted for methods that need their own form (percentages) to be activated. */
  onActivate?: () => void
}) {
  const { t } = usePreferences()
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex max-w-xl flex-col gap-1">
        <h2 className={cardTitleClass}>{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {active ? (
        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-text">
          {t('budgets.active')}
        </span>
      ) : (
        onActivate && (
          <Button onClick={onActivate} className="text-sm">
            {t('budgets.useMethod')}
          </Button>
        )
      )}
    </div>
  )
}

interface TargetRowProps {
  label: ReactNode
  /** What has been used or reached so far. */
  actual: number
  /** The limit, or the goal when `goal` is set. Null means none. */
  target: number | null
  /** A goal is met by reaching it; a limit is broken by passing it. */
  goal?: boolean
  detail?: ReactNode
  /** The row's name as plain text, for the bar; needed when `label` is not a plain string. */
  name?: string
}

/** One line of "so far vs target" with a bar and how far over / short or under / left it is. */
export function TargetRow({ label, actual, target, goal = false, detail, name }: TargetRowProps) {
  const { t, formatMoney } = usePreferences()
  const difference = target === null ? null : actual - target
  // A limit is over when passed; a goal is "short" until reached.
  const bad = difference !== null && (goal ? difference < 0 : difference > 0)
  return (
    <div className="flex flex-col gap-1.5 border-t border-line py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 wrap-anywhere font-medium text-strong">{label}</span>
        <span className="shrink-0 text-sm text-muted tabular-nums">
          <span className="font-semibold text-strong">{formatMoney(actual)}</span>
          {target !== null && ` / ${formatMoney(target)}`}
        </span>
      </div>
      {target !== null && (
        <>
          <ProgressBar ratio={target > 0 ? actual / target : actual > 0 ? 1 : 0} over={!goal && bad} label={name ?? (typeof label === 'string' ? label : '')} />
          <span className={`text-sm tabular-nums ${bad ? 'text-danger' : 'text-muted'}`}>
            {goal
              ? bad
                ? t('budgets.short', { amount: formatMoney(-difference!) })
                : t('budgets.reached')
              : bad
                ? t('budgets.over', { amount: formatMoney(difference!) })
                : t('budgets.left', { amount: formatMoney(-difference!) })}
          </span>
        </>
      )}
      {detail && <span className="text-sm text-muted">{detail}</span>}
    </div>
  )
}
