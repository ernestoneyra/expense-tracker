import { Budget } from './models/Budget.ts'
import { Category } from './models/Category.ts'
import { CategoryBudget } from './models/CategoryBudget.ts'
import { Debt } from './models/Debt.ts'
import { Expense } from './models/Expense.ts'
import { Goal } from './models/Goal.ts'
import { Income } from './models/Income.ts'
import { Recurring } from './models/Recurring.ts'
import { daysInMonth, monthStart, sumConverted, sumConvertedBy, type Convert } from './money.ts'
import { monthlyFactor } from './recurring.ts'
import { DEFAULT_CURRENCY } from './rates.ts'

/** How many full past months the emergency-fund target averages over. */
const AVERAGE_WINDOW_MONTHS = 3

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

/**
 * What the user typically spends in a month, in the converted currency: the average over the last
 * few full months that have any spending, or this month so far if there is no history yet. Null
 * when nothing has been spent at all.
 */
export async function averageMonthlySpend(sandbox: string | null, convert: Convert, now: Date) {
  const thisMonth = monthStart(now)
  const totals: number[] = []
  for (let offset = -AVERAGE_WINDOW_MONTHS; offset < 0; offset++) {
    const total = await sumConverted(
      Expense,
      { sandbox, date: { $gte: monthStart(now, offset), $lt: monthStart(now, offset + 1) } },
      convert,
    )
    if (total > 0) totals.push(total)
  }
  if (totals.length > 0) return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
  const current = await sumConverted(Expense, { sandbox, date: { $gte: thisMonth, $lt: monthStart(now, 1) } }, convert)
  return current > 0 ? current : null
}

/** Whole calendar months from `now` until `deadline`, at least 1 while the deadline is still ahead. */
function monthsUntil(deadline: Date, now: Date) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  if (deadline.getTime() <= today) return 0
  let months = (deadline.getUTCFullYear() - now.getFullYear()) * 12 + (deadline.getUTCMonth() - now.getMonth())
  if (deadline.getUTCDate() < now.getDate()) months--
  return Math.max(1, months)
}

/** Every goal with its progress, all amounts converted. Contributions stay in the goal's own currency. */
export async function describeGoals(sandbox: string | null, convert: Convert, now: Date) {
  const start = monthStart(now)
  const end = monthStart(now, 1)
  const goals = await Goal.find({ sandbox }).sort({ _id: 1 })
  const average = goals.some((g) => g.kind === 'emergency') ? await averageMonthlySpend(sandbox, convert, now) : null

  return Promise.all(
    goals.map(async (goal) => {
      const savedOwn = goal.contributions.reduce((sum, c) => sum + c.amountCents, 0)
      const saved = Math.round(await convert(savedOwn, goal.currency))
      const savedThisMonthOwn = goal.contributions
        .filter((c) => c.date >= start && c.date < end)
        .reduce((sum, c) => sum + c.amountCents, 0)
      const target =
        goal.kind === 'emergency'
          ? average === null
            ? null
            : Math.round(average * (goal.targetMonths ?? 0))
          : Math.round(await convert(goal.targetCents ?? 0, goal.currency))
      const remaining = target === null ? null : Math.max(0, target - saved)
      const months = goal.deadline ? monthsUntil(goal.deadline, now) : null

      return {
        ...goal.toJSON(),
        contributions: [...goal.toJSON().contributions].reverse(),
        savedCents: saved,
        savedThisMonthCents: Math.round(await convert(savedThisMonthOwn, goal.currency)),
        targetCents: target,
        remainingCents: remaining,
        // What to set aside each month to make the deadline; null with no deadline or once it has passed.
        monthlyNeededCents:
          remaining !== null && months ? Math.ceil(remaining / months) : null,
        overdue: Boolean(goal.deadline && months === 0 && remaining),
      }
    }),
  )
}

/** Debts with balances converted, plus what was paid on them in [start, end). */
export async function describeDebts(sandbox: string | null, convert: Convert, start: Date, end: Date) {
  const debts = await Debt.find({ sandbox }).sort({ _id: 1 })
  return Promise.all(
    debts.map(async (debt) => {
      const paidThisMonthOwn = debt.payments
        .filter((p) => p.date >= start && p.date < end)
        .reduce((sum, p) => sum + p.amountCents, 0)
      return {
        ...debt.toJSON(),
        id: debt.id as string,
        // The balance and minimum as entered, in the debt's own currency, for editing.
        ownBalanceCents: debt.balanceCents,
        ownMinPaymentCents: debt.minPaymentCents,
        payments: [...debt.toJSON().payments].reverse(),
        balanceCents: Math.round(await convert(debt.balanceCents, debt.currency)),
        startingBalanceCents: Math.round(await convert(debt.startingBalanceCents, debt.currency)),
        minPaymentCents: Math.round(await convert(debt.minPaymentCents, debt.currency)),
        paidThisMonthCents: Math.round(await convert(paidThisMonthOwn, debt.currency)),
      }
    }),
  )
}

/** What the active recurring items amount to per month, split into bills, income and yearly bills. */
export async function recurringMonthly(sandbox: string | null, convert: Convert) {
  const items = await Recurring.find({ sandbox, active: true })
  let expenses = 0
  let income = 0
  let yearlyExpenses = 0
  for (const item of items) {
    const monthly = (await convert(item.amountCents, item.currency)) * monthlyFactor[item.frequency]
    if (item.kind === 'income') income += monthly
    else {
      expenses += monthly
      if (item.frequency === 'yearly') yearlyExpenses += monthly
    }
  }
  return {
    expensesCents: Math.round(expenses),
    incomeCents: Math.round(income),
    // The part to put aside every month to be ready when a yearly bill arrives.
    sinkingFundCents: Math.round(yearlyExpenses),
  }
}

export interface CategoryRow {
  name: string
  spentCents: number
  limitCents: number | null
  costType: 'fixed' | 'variable' | null
  necessity: 'need' | 'want' | null
}

/** Every category (and any name that only exists on old expenses) with what it has cost against its limit. */
export async function categoryRows(sandbox: string | null, convert: Convert, start: Date, end: Date) {
  const [categories, limits, spent] = await Promise.all([
    Category.find({ sandbox }),
    CategoryBudget.find({ sandbox }),
    sumConvertedBy(Expense, { sandbox, date: { $gte: start, $lt: end } }, 'category', convert),
  ])
  const limitByName = new Map<string, number>()
  for (const l of limits) {
    limitByName.set(l.category, Math.round(await convert(l.limitCents, l.currency ?? DEFAULT_CURRENCY)))
  }
  const byName = new Map(categories.map((c) => [c.name, c]))
  const names = new Set([...byName.keys(), ...limitByName.keys(), ...spent.keys()])
  const rows: CategoryRow[] = [...names].map((name) => ({
    name,
    spentCents: spent.get(name) ?? 0,
    limitCents: limitByName.get(name) ?? null,
    costType: byName.get(name)?.costType ?? null,
    necessity: byName.get(name)?.necessity ?? null,
  }))
  return rows
}

/** The current month's plan against what actually happened, in the converted currency. */
export async function monthOverview(sandbox: string | null, convert: Convert, now: Date) {
  const start = monthStart(now)
  const end = monthStart(now, 1)
  const range = { $gte: start, $lt: end }

  const [budget, income, spent, rows, goals, debts, recurring] = await Promise.all([
    Budget.findOne({ sandbox }),
    sumConverted(Income, { sandbox, date: range }, convert),
    sumConverted(Expense, { sandbox, date: range }, convert),
    categoryRows(sandbox, convert, start, end),
    describeGoals(sandbox, convert, now),
    describeDebts(sandbox, convert, start, end),
    recurringMonthly(sandbox, convert),
  ])

  const days = daysInMonth(now.getFullYear(), now.getMonth())
  const elapsed = now.getDate()
  const open = debts.filter((d) => d.balanceCents > 0)

  return {
    month: monthKey(start),
    daysElapsed: elapsed,
    daysInMonth: days,
    method: budget?.method ?? 'envelope',
    needsPercent: budget?.needsPercent ?? null,
    wantsPercent: budget?.wantsPercent ?? null,
    savingsPercent: budget?.savingsPercent ?? null,
    monthlyCents: budget ? Math.round(await convert(budget.monthlyCents, budget.currency ?? DEFAULT_CURRENCY)) : 0,
    incomeCents: income,
    spentCents: spent,
    // At the current pace, what the month would total; null before anything has been spent.
    projectedSpentCents: spent > 0 ? Math.round((spent / elapsed) * days) : null,
    savedCents: goals.reduce((sum, g) => sum + g.savedThisMonthCents, 0),
    debtPaidCents: debts.reduce((sum, d) => sum + d.paidThisMonthCents, 0),
    categories: rows,
    plan: {
      limitsCents: rows.reduce((sum, r) => sum + (r.limitCents ?? 0), 0),
      goalsCents: goals.reduce((sum, g) => sum + (g.monthlyNeededCents ?? 0), 0),
      debtMinimumsCents: open.reduce((sum, d) => sum + d.minPaymentCents, 0),
      sinkingFundCents: recurring.sinkingFundCents,
    },
  }
}
