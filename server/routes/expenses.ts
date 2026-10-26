import { Router } from 'express'
import { Category, NAME_COLLATION } from '../models/Category.ts'
import { Expense } from '../models/Expense.ts'

export const expensesRouter = Router()

expensesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500)
  const expenses = await Expense.find().sort({ date: -1, _id: -1 }).limit(limit)
  res.json(expenses)
})

expensesRouter.post('/', async (req, res) => {
  const { title, category, description, date, amountCents } = req.body ?? {}
  // Look the name up ignoring case and store the canonical spelling.
  const match =
    typeof category === 'string' && category.trim()
      ? await Category.findOne({ name: category.trim() }).collation(NAME_COLLATION)
      : null
  if (!match) {
    res.status(400).json({ error: 'Choose an existing category' })
    return
  }
  const expense = await Expense.create({
    title,
    category: match.name,
    // Blank means "no description", so don't store an empty string.
    description: typeof description === 'string' && description.trim() ? description : undefined,
    date,
    amountCents,
  })
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
