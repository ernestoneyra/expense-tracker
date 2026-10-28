export const CURRENCIES = ['SEK', 'EUR', 'GBP', 'JPY', 'USD', 'TWD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const DEFAULT_CURRENCY: Currency = 'USD'

export const isCurrency = (value: unknown): value is Currency =>
  CURRENCIES.some((c) => c === value)

// Free daily rates (https://www.exchangerate-api.com), no API key. Covers all of CURRENCIES.
const SOURCE = 'https://open.er-api.com/v6/latest/USD'
const MAX_AGE_MS = 6 * 60 * 60 * 1000
const MIN_REFRESH_MS = 60 * 1000

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
let lastFetchFailed = false

async function fetchRates(): Promise<Rates> {
  try {
    return await requestRates()
  } catch {
    // One retry: transient DNS/connection hiccups are the usual cause of "fetch failed".
    return await requestRates()
  }
}

async function requestRates(): Promise<Rates> {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(10_000) })
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

async function load(force: boolean): Promise<Rates> {
  if (!force && cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached

  // Concurrent callers share one request.
  inflight ??= fetchRates()
    .then((fresh) => {
      cached = { ...fresh, fetchedAt: Date.now() }
      lastFetchFailed = false
      return fresh
    })
    .finally(() => {
      inflight = undefined
    })

  try {
    return await inflight
  } catch (err) {
    lastFetchFailed = true
    // Node's fetch hides the real reason (ENOTFOUND, ETIMEDOUT, certificate errors…) in `cause`.
    const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : ''
    console.error(`Failed to fetch exchange rates: ${err instanceof Error ? err.message : err}${cause}`)
    if (cached) return cached
    throw new RatesUnavailableError()
  }
}

/** Current rates, refreshed at most every few hours. Falls back to the last good copy if the provider is down. */
export const getRates = () => load(false)

interface RatesStatus extends Rates {
  /** When this server last fetched the rates from the provider (ISO). */
  fetchedAt: string
  /** The latest attempt to reach the provider failed, so these are an older saved copy. */
  stale: boolean
}

/** The rates plus how fresh they are. `refresh` asks the provider again, but not more than once a minute. */
export async function getRatesStatus(refresh = false): Promise<RatesStatus> {
  await load(refresh && (!cached || Date.now() - cached.fetchedAt >= MIN_REFRESH_MS))
  const { rates, updatedAt, fetchedAt } = cached!
  return { rates, updatedAt, fetchedAt: new Date(fetchedAt).toISOString(), stale: lastFetchFailed }
}

/** Convert an amount in minor units. Every currency uses the same ×100 storage, so this is a plain ratio. */
export function convertCents(cents: number, from: Currency, to: Currency, { rates }: Rates) {
  return from === to ? cents : (cents * rates[to]) / rates[from]
}
