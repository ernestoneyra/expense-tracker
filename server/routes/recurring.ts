import { Router } from 'express'
import { Category, NAME_COLLATION } from '../models/Category.ts'
import { Recurring } from '../models/Recurring.ts'
import { converterTo, currencyParam } from '../money.ts'
import { recurringMonthly } from '../planning.ts'
import { monthlyFactor } from '../recurring.ts'
import { DEMO_MODE, MAX_RECORDS, sandboxOf } from '../sandbox.ts'

export const recurringRouter = Router()

// Everything that repeats, soonest first, with what each costs per month and the totals, in the
// `currency` query parameter. Items keep their own currency and amount too.
recurringRouter.get('/', async (req, res) => {
  const currency = currencyParam(req, res)
  if (!currency) return
  const sandbox = sandboxOf(res)
  const convert = converterTo(currency)
  const [items, totals] = await Promise.all([
    Recurring.find({ sandbox }).sort({ active: -1, nextDue: 1, _id: 1 }),
    recurringMonthly(sandbox, convert),
  ])
  res.json({
    currency,
    totals,
    items: await Promise.all(
      items.map(async (item) => ({
        ...item.toJSON(),
        monthlyCents: Math.round((await convert(item.amountCents, item.currency)) * monthlyFactor[item.frequency]),
      })),
    ),
  })
})

recurringRouter.post('/', async (req, res) => {
  const sandbox = sandboxOf(res)
  const { kind, title, category, currency, amountCents, frequency, startDate } = req.body ?? {}

  let categoryName: string | undefined
  if (kind === 'expense') {
    const match =
      typeof category === 'string' && category.trim()
        ? await Category.findOne({ sandbox, name: category.trim() }).collation(NAME_COLLATION)
        : null
    if (!match) {
      res.status(400).json({ error: 'Choose an existing category' })
      return
    }
    categoryName = match.name
  }
  if (DEMO_MODE && (await Recurring.countDocuments({ sandbox })) >= MAX_RECORDS) {
    res.status(400).json({ error: `The demo is limited to ${MAX_RECORDS} recurring items` })
    return
  }

  const nextDue = new Date(startDate)
  if (Number.isNaN(nextDue.getTime())) {
    res.status(400).json({ error: 'Choose a start date' })
    return
  }
  const item = await Recurring.create({
    sandbox,
    kind,
    title,
    category: categoryName,
    currency,
    amountCents,
    frequency,
    nextDue,
    anchorDay: nextDue.getUTCDate(),
  })
  res.status(201).json(item)
})

// Pauses or resumes an item. A paused item creates nothing until it is resumed.
recurringRouter.patch('/:id', async (req, res) => {
  const item = await Recurring.findOneAndUpdate(
    { _id: req.params.id, sandbox: sandboxOf(res) },
    { active: req.body?.active },
    { returnDocument: 'after', runValidators: true },
  )
  if (!item) {
    res.status(404).json({ error: 'Recurring item not found' })
    return
  }
  res.json(item)
})

// Entries it already created stay.
recurringRouter.delete('/:id', async (req, res) => {
  const deleted = await Recurring.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Recurring item not found' })
    return
  }
  res.status(204).end()
})
