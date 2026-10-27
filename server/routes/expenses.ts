import { Router } from 'express'
import { Category, NAME_COLLATION } from '../models/Category.ts'
import { Expense } from '../models/Expense.ts'
import { DEMO_MODE, MAX_EXPENSES, sandboxOf } from '../sandbox.ts'

export const expensesRouter = Router()

expensesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500)
  const expenses = await Expense.find({ sandbox: sandboxOf(res) }).sort({ date: -1, _id: -1 }).limit(limit)
  res.json(expenses)
})

expensesRouter.post('/', async (req, res) => {
  const sandbox = sandboxOf(res)
  const { title, category, description, currency, date, amountCents } = req.body ?? {}
  // Look the name up ignoring case and store the canonical spelling.
  const match =
    typeof category === 'string' && category.trim()
      ? await Category.findOne({ sandbox, name: category.trim() }).collation(NAME_COLLATION)
      : null
  if (!match) {
    res.status(400).json({ error: 'Choose an existing category' })
    return
  }
  if (DEMO_MODE && (await Expense.countDocuments({ sandbox })) >= MAX_EXPENSES) {
    res.status(400).json({ error: `The demo is limited to ${MAX_EXPENSES} expenses` })
    return
  }
  const expense = await Expense.create({
    sandbox,
    title,
    category: match.name,
    // Blank means "no description", so don't store an empty string.
    description: typeof description === 'string' && description.trim() ? description : undefined,
    currency,
    date,
    amountCents,
  })
  res.status(201).json(expense)
})

expensesRouter.delete('/:id', async (req, res) => {
  const deleted = await Expense.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Expense not found' })
    return
  }
  res.status(204).end()
})
