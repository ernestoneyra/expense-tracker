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

export interface Category {
  id: string
  name: string
  /** How many expenses use this category. */
  count: number
}

export interface Summary {
  /** The currency every amount below is in, except those in `recent`. */
  currency: Currency
  spentCents: number
  prevSpentCents: number
  transactions: number
  budgetCents: number
  topCategory: { name: string; cents: number } | null
  recent: Expense[]
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('x-sandbox-id', getSandboxId())
  if (init?.body) headers.set('content-type', 'application/json')
  const res = await fetch(`/api${path}`, { ...init, headers })
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
