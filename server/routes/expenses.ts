import { Router } from 'express'
import { Expense } from '../models/Expense.ts'

export const expensesRouter = Router()

expensesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500)
  const expenses = await Expense.find().sort({ date: -1, _id: -1 }).limit(limit)
  res.json(expenses)
})

expensesRouter.post('/', async (req, res) => {
  const { title, category, date, amountCents } = req.body ?? {}
  const expense = await Expense.create({ title, category, date, amountCents })
  res.status(201).json(expense)
})

expensesRouter.delete('/:id', async (req, res) => {
  const deleted = await Expense.findByIdAndDelete(req.params.id)
  if (!deleted) {
    res.status(404).json({ error: 'Expense not found' })
    return
  }
  res.status(204).end()
})
