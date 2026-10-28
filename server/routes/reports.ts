import { Router } from 'express'
import { Budget } from '../models/Budget.ts'
import { Expense } from '../models/Expense.ts'
import { Income } from '../models/Income.ts'
import { converterTo, currencyOf, currencyParam, monthStart } from '../money.ts'
import { DEFAULT_CURRENCY, type Currency } from '../rates.ts'
import { sandboxOf } from '../sandbox.ts'

export const reportsRouter = Router()

const MAX_MONTHS = 24

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

// Income and spending month by month for the last `months` months (this one included), with the
// spending split by category, all converted into the `currency` query parameter.
reportsRouter.get('/', async (req, res) => {
  const currency = currencyParam(req, res)
  if (!currency) return
  const count = Number(req.query.months ?? 6)
  if (!Number.isInteger(count) || count < 1 || count > MAX_MONTHS) {
    res.status(400).json({ error: `months must be a whole number from 1 to ${MAX_MONTHS}` })
    return
  }
  const sandbox = sandboxOf(res)
  const convert = converterTo(currency)
  const now = new Date()
  const match = { sandbox, date: { $gte: monthStart(now, 1 - count), $lt: monthStart(now, 1) } }
  const month = { $dateToString: { format: '%Y-%m', date: '$date' } }

  const [spendRows, incomeRows, budget] = await Promise.all([
    Expense.aggregate<{ _id: { month: string; category: string; currency: Currency }; total: number }>([
      { $match: match },
      { $group: { _id: { month, category: '$category', currency: currencyOf }, total: { $sum: '$amountCents' } } },
    ]),
    Income.aggregate<{ _id: { month: string; currency: Currency }; total: number }>([
      { $match: match },
      { $group: { _id: { month, currency: currencyOf }, total: { $sum: '$amountCents' } } },
    ]),
    Budget.findOne({ sandbox }),
  ])

  const months = Array.from({ length: count }, (_, i) => monthKey(monthStart(now, i + 1 - count)))
  const index = new Map(months.map((m, i) => [m, i]))
  const incomeCents = months.map(() => 0)
  const spentCents = months.map(() => 0)
  const byCategory = new Map<string, number[]>()

  for (const r of incomeRows) {
    incomeCents[index.get(r._id.month)!] += await convert(r.total, r._id.currency)
  }
  for (const r of spendRows) {
    const i = index.get(r._id.month)!
    const cents = await convert(r.total, r._id.currency)
    spentCents[i] += cents
    const row = byCategory.get(r._id.category) ?? months.map(() => 0)
    row[i] += cents
    byCategory.set(r._id.category, row)
  }

  const categories = [...byCategory]
    .map(([name, cents]) => ({ name, cents: cents.map(Math.round) }))
    .sort((a, b) => b.cents.reduce((s, c) => s + c, 0) - a.cents.reduce((s, c) => s + c, 0))

  res.json({
    currency,
    months,
    incomeCents: incomeCents.map(Math.round),
    spentCents: spentCents.map(Math.round),
    categories,
    // Only today's budget is stored, so past months are measured against it too.
    budgetCents: budget ? Math.round(await convert(budget.monthlyCents, budget.currency ?? DEFAULT_CURRENCY)) : 0,
  })
})
