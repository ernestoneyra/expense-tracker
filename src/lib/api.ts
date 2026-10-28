import { useCallback, useEffect, useState } from 'react'
import type { Currency } from '../i18n/config.ts'
import { accessToken, refresh } from '../auth/tokens.ts'
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

/** A failed request. `code` is the server's machine-readable reason (e.g. `username_taken`), when it gave one. */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Fired when the server says nobody is signed in, e.g. because the session expired. */
export const UNAUTHORIZED_EVENT = 'expenser:unauthorized'

async function send(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  // Only used by the hosted demo's anonymous sandboxes; the server ignores it for signed-in people.
  headers.set('x-sandbox-id', getSandboxId())
  if (init?.body) headers.set('content-type', 'application/json')
  // The access token, renewed first if it is about to run out. (Nothing is sent when signed out.)
  const token = await accessToken()
  if (token) headers.set('authorization', `Bearer ${token}`)
  return { res: await fetch(`/api${path}`, { ...init, headers }), token }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const first = await send(path, init)
  let res = first.res
  // Rejected although it looked fine to us: it was revoked, or the clock is off. Renew once and retry.
  if (res.status === 401 && first.token && (await res.clone().json().catch(() => null))?.code === 'invalid_token' && (await refresh())) {
    res = (await send(path, init)).res
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    if (body?.code === 'unauthorized' || body?.code === 'invalid_token') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.code)
  }
  return res
}

/** Fired after a change went through, so one live region can announce it to screen readers (4.1.3). */
export const SAVED_EVENT = 'expenser:saved'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init)
  const method = (init?.method ?? 'GET').toUpperCase()
  // Reading data, refreshing exchange rates and signing in or out are not changes the person made to their data.
  if (method !== 'GET' && !path.startsWith('/rates') && !path.startsWith('/auth')) {
    window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { method } }))
  }
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
