import { useCallback, useEffect, useState } from 'react'

export interface Expense {
  id: string
  title: string
  category: string
  /** ISO timestamp at UTC midnight of the expense's calendar day. */
  date: string
  amountCents: number
}

export interface NewExpense {
  title: string
  category: string
  /** YYYY-MM-DD */
  date: string
  amountCents: number
}

export interface Category {
  id: string
  name: string
  /** How many expenses use this category. */
  count: number
}

export interface Summary {
  spentCents: number
  prevSpentCents: number
  transactions: number
  budgetCents: number
  topCategory: { name: string; cents: number } | null
  recent: Expense[]
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
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

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const formatMoney = (cents: number) => currency.format(cents / 100)

// Dates are calendar days stored at UTC midnight, so format in UTC to avoid off-by-one shifts.
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
