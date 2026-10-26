import { Router } from 'express'
import { Budget } from '../models/Budget.ts'
import { Expense } from '../models/Expense.ts'

export const summaryRouter = Router()

async function totalBetween(start: Date, end: Date) {
  const [row] = await Expense.aggregate<{ total: number; count: number }>([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amountCents' }, count: { $sum: 1 } } },
  ])
  return { total: row?.total ?? 0, count: row?.count ?? 0 }
}

// Everything the dashboard shows, for the current calendar month.
summaryRouter.get('/', async (_req, res) => {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const nextMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
  const prevMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))

  const [month, prev, [top], budget, recent] = await Promise.all([
    totalBetween(monthStart, nextMonthStart),
    totalBetween(prevMonthStart, monthStart),
    Expense.aggregate<{ _id: string; total: number }>([
      { $match: { date: { $gte: monthStart, $lt: nextMonthStart } } },
      { $group: { _id: '$category', total: { $sum: '$amountCents' } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]),
    Budget.findOne(),
    Expense.find().sort({ date: -1, _id: -1 }).limit(5),
  ])

  res.json({
    spentCents: month.total,
    prevSpentCents: prev.total,
    transactions: month.count,
    budgetCents: budget?.monthlyCents ?? 0,
    topCategory: top ? { name: top._id, cents: top.total } : null,
    recent,
  })
})
