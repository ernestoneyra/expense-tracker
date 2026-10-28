import { Router } from 'express'
import { Budget, BUDGET_METHODS } from '../models/Budget.ts'
import { Category, NAME_COLLATION } from '../models/Category.ts'
import { CategoryBudget } from '../models/CategoryBudget.ts'
import { converterTo, currencyParam } from '../money.ts'
import { monthOverview } from '../planning.ts'
import { DEMO_MODE, MAX_RECORDS, sandboxOf } from '../sandbox.ts'

export const budgetRouter = Router()

const settings = (budget: InstanceType<typeof Budget> | null) => ({
  monthlyCents: budget?.monthlyCents ?? 0,
  currency: budget?.currency,
  method: budget?.method ?? 'envelope',
  needsPercent: budget?.needsPercent ?? null,
  wantsPercent: budget?.wantsPercent ?? null,
  savingsPercent: budget?.savingsPercent ?? null,
})

budgetRouter.get('/', async (_req, res) => {
  res.json(settings(await Budget.findOne({ sandbox: sandboxOf(res) })))
})

budgetRouter.put('/', async (req, res) => {
  const budget = await Budget.findOneAndUpdate(
    { sandbox: sandboxOf(res) },
    // An omitted currency is left out of the update so the existing one (or the default) stays.
    { monthlyCents: req.body?.monthlyCents, currency: req.body?.currency },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  res.json(settings(budget))
})

// Which way of planning the month to use, and the percentages the percentage-based ones need.
budgetRouter.put('/method', async (req, res) => {
  const { method, needsPercent, wantsPercent, savingsPercent } = req.body ?? {}
  if (!BUDGET_METHODS.includes(method)) {
    res.status(400).json({ error: 'Unknown budgeting method' })
    return
  }
  if (method === 'split' && ![needsPercent, wantsPercent, savingsPercent].every(Number.isFinite)) {
    res.status(400).json({ error: 'Enter a percentage for needs, wants and savings' })
    return
  }
  if (method === 'split' && Math.abs(needsPercent + wantsPercent + savingsPercent - 100) > 0.001) {
    res.status(400).json({ error: 'The percentages must add up to 100' })
    return
  }
  if (method === 'payFirst' && !Number.isFinite(savingsPercent)) {
    res.status(400).json({ error: 'Enter the percentage of income to save' })
    return
  }
  const budget = await Budget.findOneAndUpdate(
    { sandbox: sandboxOf(res) },
    {
      method,
      needsPercent: method === 'split' ? needsPercent : undefined,
      wantsPercent: method === 'split' ? wantsPercent : undefined,
      savingsPercent: method === 'split' || method === 'payFirst' ? savingsPercent : undefined,
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  res.json(settings(budget))
})

budgetRouter.get('/categories', async (_req, res) => {
  res.json(await CategoryBudget.find({ sandbox: sandboxOf(res) }))
})

// Sets (or replaces) the monthly limit of one category.
budgetRouter.put('/categories', async (req, res) => {
  const sandbox = sandboxOf(res)
  const { category, limitCents, currency } = req.body ?? {}
  const match =
    typeof category === 'string' && category.trim()
      ? await Category.findOne({ sandbox, name: category.trim() }).collation(NAME_COLLATION)
      : null
  if (!match) {
    res.status(400).json({ error: 'Choose an existing category' })
    return
  }
  if (DEMO_MODE && !(await CategoryBudget.exists({ sandbox, category: match.name }))) {
    if ((await CategoryBudget.countDocuments({ sandbox })) >= MAX_RECORDS) {
      res.status(400).json({ error: `The demo is limited to ${MAX_RECORDS} category limits` })
      return
    }
  }
  const limit = await CategoryBudget.findOneAndUpdate(
    { sandbox, category: match.name },
    { limitCents, currency },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  res.json(limit)
})

budgetRouter.delete('/categories/:id', async (req, res) => {
  const deleted = await CategoryBudget.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Limit not found' })
    return
  }
  res.status(204).end()
})

// The current month's plan against what actually happened, in the `currency` query parameter.
budgetRouter.get('/overview', async (req, res) => {
  const currency = currencyParam(req, res)
  if (!currency) return
  res.json({ currency, ...(await monthOverview(sandboxOf(res), converterTo(currency), new Date())) })
})
