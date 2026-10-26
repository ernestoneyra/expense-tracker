export const CURRENCIES = ['SEK', 'EUR', 'GBP', 'JPY', 'USD', 'TWD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const DEFAULT_CURRENCY: Currency = 'USD'

export const isCurrency = (value: unknown): value is Currency =>
  CURRENCIES.some((c) => c === value)

// Free daily rates (https://www.exchangerate-api.com), no API key. Covers all of CURRENCIES.
const SOURCE = 'https://open.er-api.com/v6/latest/USD'
const MAX_AGE_MS = 6 * 60 * 60 * 1000

export interface Rates {
  /** Units of each currency per 1 USD. */
  rates: Record<Currency, number>
  /** When the provider last updated these rates (ISO). */
  updatedAt: string
}

export class RatesUnavailableError extends Error {
  constructor() {
    super('Exchange rates are currently unavailable')
  }
}

let cached: (Rates & { fetchedAt: number }) | undefined
let inflight: Promise<Rates> | undefined

async function fetchRates(): Promise<Rates> {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Rates request failed (${res.status})`)
  const body = (await res.json()) as {
    result?: string
    time_last_update_unix?: number
    rates?: Record<string, number>
  }
  if (body.result !== 'success' || !body.rates) throw new Error('Unexpected rates response')

  const rates = {} as Record<Currency, number>
  for (const c of CURRENCIES) {
    const rate = body.rates[c]
    if (typeof rate !== 'number' || !(rate > 0)) throw new Error(`Missing rate for ${c}`)
    rates[c] = rate
  }
  const updated = body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000) : new Date()
  return { rates, updatedAt: updated.toISOString() }
}

/** Current rates, refreshed at most every few hours. Falls back to the last good copy if the provider is down. */
export async function getRates(): Promise<Rates> {
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached

  // Concurrent callers share one request.
  inflight ??= fetchRates()
    .then((fresh) => {
      cached = { ...fresh, fetchedAt: Date.now() }
      return fresh
    })
    .finally(() => {
      inflight = undefined
    })

  try {
    return await inflight
  } catch (err) {
    console.error('Failed to fetch exchange rates:', err instanceof Error ? err.message : err)
    if (cached) return cached
    throw new RatesUnavailableError()
  }
}

/** Convert an amount in minor units. Every currency uses the same ×100 storage, so this is a plain ratio. */
export function convertCents(cents: number, from: Currency, to: Currency, { rates }: Rates) {
  return from === to ? cents : (cents * rates[to]) / rates[from]
}
