import { Router } from 'express'
import { Budget } from '../models/Budget.ts'
import { Expense } from '../models/Expense.ts'
import { Income } from '../models/Income.ts'
import { converterTo, currencyOf, currencyParam, sumConverted, type Convert } from '../money.ts'
import { categoryRows } from '../planning.ts'
import { DEFAULT_CURRENCY, type Currency } from '../rates.ts'
import { sandboxOf } from '../sandbox.ts'

export const summaryRouter = Router()

async function totalBetween(sandbox: string | null, start: Date, end: Date, convert: Convert) {
  const rows = await Expense.aggregate<{ _id: Currency; total: number; count: number }>([
    { $match: { sandbox, date: { $gte: start, $lt: end } } },
    { $group: { _id: currencyOf, total: { $sum: '$amountCents' }, count: { $sum: 1 } } },
  ])
  const converted = await Promise.all(rows.map((r) => convert(r.total, r._id)))
  return {
    total: Math.round(converted.reduce((sum, cents) => sum + cents, 0)),
    count: rows.reduce((sum, r) => sum + r.count, 0),
  }
}

async function topCategory(sandbox: string | null, start: Date, end: Date, convert: Convert) {
  const rows = await Expense.aggregate<{ _id: { category: string; currency: Currency }; total: number }>([
    { $match: { sandbox, date: { $gte: start, $lt: end } } },
    { $group: { _id: { category: '$category', currency: currencyOf }, total: { $sum: '$amountCents' } } },
  ])
  const totals = new Map<string, number>()
  for (const r of rows) {
    totals.set(r._id.category, (totals.get(r._id.category) ?? 0) + (await convert(r.total, r._id.currency)))
  }
  let top: { name: string; cents: number } | null = null
  for (const [name, cents] of totals) {
    if (!top || cents > top.cents) top = { name, cents: Math.round(cents) }
  }
  return top
}

// Everything the dashboard shows for the current calendar month. Money is converted into the
// `currency` query parameter, except `recent`, whose expenses keep the currency they were saved in.
summaryRouter.get('/', async (req, res) => {
  const requested = currencyParam(req, res)
  if (!requested) return
  const convert = converterTo(requested)
  const sandbox = sandboxOf(res)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const nextMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
  const prevMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))

  const [month, prev, top, budget, recent, income, categories] = await Promise.all([
    totalBetween(sandbox, monthStart, nextMonthStart, convert),
    totalBetween(sandbox, prevMonthStart, monthStart, convert),
    topCategory(sandbox, monthStart, nextMonthStart, convert),
    Budget.findOne({ sandbox }),
    Expense.find({ sandbox }).sort({ date: -1, _id: -1 }).limit(5),
    sumConverted(Income, { sandbox, date: { $gte: monthStart, $lt: nextMonthStart } }, convert),
    categoryRows(sandbox, convert, monthStart, nextMonthStart),
  ])

  res.json({
    currency: requested,
    spentCents: month.total,
    prevSpentCents: prev.total,
    transactions: month.count,
    budgetCents: budget ? Math.round(await convert(budget.monthlyCents, budget.currency ?? DEFAULT_CURRENCY)) : 0,
    incomeCents: income,
    topCategory: top,
    // Categories that have gone past their monthly limit, worst first.
    overBudget: categories
      .filter((c) => c.limitCents !== null && c.spentCents > c.limitCents)
      .map((c) => ({ name: c.name, spentCents: c.spentCents, limitCents: c.limitCents! }))
      .sort((a, b) => b.spentCents - b.limitCents - (a.spentCents - a.limitCents)),
    recent,
  })
})
