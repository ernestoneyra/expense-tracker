import type { Request, Response } from 'express'
import type { Model } from 'mongoose'
import { convertCents, DEFAULT_CURRENCY, getRates, isCurrency, type Currency, type Rates } from './rates.ts'

/** The `currency` query parameter, defaulting to the app default; answers 400 and returns undefined if it is unsupported. */
export function currencyParam(req: Request, res: Response) {
  const requested = req.query.currency ?? DEFAULT_CURRENCY
  if (isCurrency(requested)) return requested
  res.status(400).json({ error: 'Unsupported currency' })
}

// Records saved before currencies existed have no currency field.
export const currencyOf = { $ifNull: ['$currency', DEFAULT_CURRENCY] }

export type Convert = (cents: number, from: Currency) => Promise<number>

// Converts into `target`, fetching rates only if some amount is in another currency.
export function converterTo(target: Currency): Convert {
  let rates: Promise<Rates> | undefined
  return async (cents, from) =>
    from === target ? cents : convertCents(cents, from, target, await (rates ??= getRates()))
}

/** First day of the month `offset` months from now, as UTC midnight (the way dates are stored). */
export function monthStart(now: Date, offset = 0) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1))
}

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

/** Anything with an `aggregate`, which is all the helpers below need from a model. */
type Aggregatable = Pick<Model<object>, 'aggregate'>

/** Sums `$amountCents` per currency over the matching documents and converts every group into one total. */
export async function sumConverted(model: Aggregatable, match: object, convert: Convert) {
  const rows = await model.aggregate<{ _id: Currency; total: number }>([
    { $match: match },
    { $group: { _id: currencyOf, total: { $sum: '$amountCents' } } },
  ])
  const converted = await Promise.all(rows.map((r) => convert(r.total, r._id)))
  return Math.round(converted.reduce((sum, cents) => sum + cents, 0))
}

/** Like sumConverted, but split by the value of one field (e.g. the category). */
// `field` is written into the pipeline as `$field`, so it is typed as the one name used, never a string
// that could have come from a request.
export async function sumConvertedBy(model: Aggregatable, match: object, field: 'category', convert: Convert) {
  const rows = await model.aggregate<{ _id: { key: string; currency: Currency }; total: number }>([
    { $match: match },
    { $group: { _id: { key: `$${field}`, currency: currencyOf }, total: { $sum: '$amountCents' } } },
  ])
  const totals = new Map<string, number>()
  for (const r of rows) {
    totals.set(r._id.key, (totals.get(r._id.key) ?? 0) + (await convert(r.total, r._id.currency)))
  }
  return new Map([...totals].map(([key, cents]) => [key, Math.round(cents)]))
}
