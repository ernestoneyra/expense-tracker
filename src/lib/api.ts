import { useCallback, useEffect, useState } from 'react'
import type { Currency } from '../i18n/config.ts'
import { getSandboxId } from './sandbox.ts'

export interface Expense {
  id: string
  title: string
  category: string
  description?: string
  /** ISO timestamp at UTC midnight of the expense's calendar day. */
  date: string
  /** The currency amountCents was entered in. */
  currency: Currency
  amountCents: number
}

export interface NewExpense {
  title: string
  category: string
  description?: string
  /** YYYY-MM-DD */
  date: string
  currency: Currency
  amountCents: number
}

export type CostType = 'fixed' | 'variable'
export type Necessity = 'need' | 'want'

export interface Category {
  id: string
  name: string
  /** How many expenses use this category. */
  count: number
  /** Set by the user; absent until classified. */
  costType?: CostType
  necessity?: Necessity
}

export interface Income {
  id: string
  title: string
  /** ISO timestamp at UTC midnight of the income's calendar day. */
  date: string
  currency: Currency
  amountCents: number
}

export interface NewIncome {
  title: string
  /** YYYY-MM-DD */
  date: string
  currency: Currency
  amountCents: number
}

export interface Summary {
  /** The currency every amount below is in, except those in `recent`. */
  currency: Currency
  spentCents: number
  prevSpentCents: number
  transactions: number
  budgetCents: number
  incomeCents: number
  topCategory: { name: string; cents: number } | null
  /** Categories past their monthly limit, worst first. */
  overBudget: { name: string; spentCents: number; limitCents: number }[]
  recent: Expense[]
}

export type BudgetMethod = 'envelope' | 'split' | 'zeroBased' | 'payFirst'

export interface BudgetSettings {
  monthlyCents: number
  method: BudgetMethod
  needsPercent: number | null
  wantsPercent: number | null
  savingsPercent: number | null
}

export interface CategoryLimit {
  id: string
  category: string
  /** In `currency`, the one it was entered in. */
  limitCents: number
  currency: Currency
}

export interface CategoryRow {
  name: string
  spentCents: number
  limitCents: number | null
  costType: CostType | null
  necessity: Necessity | null
}

/** The current month's plan against what happened. Every amount is in `currency`. */
export interface Overview extends BudgetSettings {
  currency: Currency
  month: string
  daysElapsed: number
  daysInMonth: number
  incomeCents: number
  spentCents: number
  projectedSpentCents: number | null
  savedCents: number
  debtPaidCents: number
  categories: CategoryRow[]
  plan: {
    limitsCents: number
    goalsCents: number
    debtMinimumsCents: number
    sinkingFundCents: number
  }
}

export interface Goal {
  id: string
  name: string
  kind: 'savings' | 'emergency'
  /** The currency contributions are entered in; the amounts below are in the display currency. */
  currency: Currency
  targetMonths?: number
  /** ISO timestamp at UTC midnight. */
  deadline?: string
  savedCents: number
  /** Null for an emergency fund until there is spending to base it on. */
  targetCents: number | null
  remainingCents: number | null
  monthlyNeededCents: number | null
  overdue: boolean
  /** In the goal's own currency, newest first. Negative amounts are withdrawals. */
  contributions: { id: string; date: string; amountCents: number }[]
}

export interface GoalsResponse {
  currency: Currency
  averageSpendCents: number | null
  goals: Goal[]
}

export interface Debt {
  id: string
  name: string
  /** The currency payments are entered in; the amounts below are in the display currency. */
  currency: Currency
  aprPercent: number
  startingBalanceCents: number
  balanceCents: number
  minPaymentCents: number
  /** The balance and minimum payment in the debt's own `currency`. */
  ownBalanceCents: number
  ownMinPaymentCents: number
  paidThisMonthCents: number
  /** In the debt's own currency, newest first. */
  payments: { id: string; date: string; amountCents: number }[]
}

export interface PayoffPlan {
  months: number | null
  interestCents: number | null
  order: { id: string; month: number | null }[]
}

export interface DebtsResponse {
  currency: Currency
  extraCents: number
  debts: Debt[]
  plan: { avalanche: PayoffPlan; snowball: PayoffPlan }
}

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface RecurringItem {
  id: string
  kind: 'expense' | 'income'
  title: string
  category?: string
  currency: Currency
  amountCents: number
  frequency: Frequency
  /** ISO timestamp at UTC midnight. */
  nextDue: string
  active: boolean
  /** What it comes to per month, in the display currency. */
  monthlyCents: number
}

export interface RecurringResponse {
  currency: Currency
  totals: { expensesCents: number; incomeCents: number; sinkingFundCents: number }
  items: RecurringItem[]
}

export interface Report {
  currency: Currency
  /** YYYY-MM, oldest first; the other arrays line up with it. */
  months: string[]
  incomeCents: number[]
  spentCents: number[]
  categories: { name: string; cents: number[] }[]
  budgetCents: number
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('x-sandbox-id', getSandboxId())
  if (init?.body) headers.set('content-type', 'application/json')
  const res = await fetch(`/api${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init)
  return res.status === 204 ? (undefined as T) : res.json()
}

/** Fetches a file from the API and saves it through the browser's download flow. */
export async function download(path: string, fallbackName: string) {
  const res = await request(path)
  // The server names the file (it knows the date); the sandbox header means a plain link can't be used.
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function useApi<T>(path: string) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: true,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    api<T>(path, { signal: ctrl.signal }).then(
      (data) => setState({ data, loading: false }),
      (err: Error) => {
        if (!ctrl.signal.aborted) setState({ error: err.message, loading: false })
      },
    )
    return () => ctrl.abort()
  }, [path, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
