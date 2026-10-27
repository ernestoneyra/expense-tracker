import { Router } from 'express'
import { Budget } from '../models/Budget.ts'

export const budgetRouter = Router()

budgetRouter.get('/', async (_req, res) => {
  const budget = await Budget.findOne()
  res.json({ monthlyCents: budget?.monthlyCents ?? 0, currency: budget?.currency })
})

budgetRouter.put('/', async (req, res) => {
  const budget = await Budget.findOneAndUpdate(
    {},
    // An omitted currency is left out of the update so the existing one (or the default) stays.
    { monthlyCents: req.body?.monthlyCents, currency: req.body?.currency },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  res.json({ monthlyCents: budget.monthlyCents, currency: budget.currency })
})
