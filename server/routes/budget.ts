import { Router } from 'express'
import { Budget } from '../models/Budget.ts'
import { sandboxOf } from '../sandbox.ts'

export const budgetRouter = Router()

budgetRouter.get('/', async (_req, res) => {
  const budget = await Budget.findOne({ sandbox: sandboxOf(res) })
  res.json({ monthlyCents: budget?.monthlyCents ?? 0, currency: budget?.currency })
})

budgetRouter.put('/', async (req, res) => {
  const budget = await Budget.findOneAndUpdate(
    { sandbox: sandboxOf(res) },
    // An omitted currency is left out of the update so the existing one (or the default) stays.
    { monthlyCents: req.body?.monthlyCents, currency: req.body?.currency },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  res.json({ monthlyCents: budget.monthlyCents, currency: budget.currency })
})
