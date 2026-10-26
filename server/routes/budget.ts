import { Router } from 'express'
import { Budget } from '../models/Budget.ts'

export const budgetRouter = Router()

budgetRouter.get('/', async (_req, res) => {
  const budget = await Budget.findOne()
  res.json({ monthlyCents: budget?.monthlyCents ?? 0 })
})

budgetRouter.put('/', async (req, res) => {
  const budget = await Budget.findOneAndUpdate(
    {},
    { monthlyCents: req.body?.monthlyCents },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  res.json({ monthlyCents: budget.monthlyCents })
})
