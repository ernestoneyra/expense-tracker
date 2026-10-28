import { Router } from 'express'
import { Goal } from '../models/Goal.ts'
import { converterTo, currencyParam } from '../money.ts'
import { averageMonthlySpend, describeGoals } from '../planning.ts'
import { DEMO_MODE, MAX_RECORDS, sandboxOf } from '../sandbox.ts'

export const goalsRouter = Router()

// Savings goals and the emergency fund, with amounts converted into the `currency` query parameter.
goalsRouter.get('/', async (req, res) => {
  const currency = currencyParam(req, res)
  if (!currency) return
  const sandbox = sandboxOf(res)
  const convert = converterTo(currency)
  const now = new Date()
  const [goals, averageSpendCents] = await Promise.all([
    describeGoals(sandbox, convert, now),
    averageMonthlySpend(sandbox, convert, now),
  ])
  res.json({ currency, averageSpendCents, goals })
})

goalsRouter.post('/', async (req, res) => {
  const sandbox = sandboxOf(res)
  if (DEMO_MODE && (await Goal.countDocuments({ sandbox })) >= MAX_RECORDS) {
    res.status(400).json({ error: `The demo is limited to ${MAX_RECORDS} goals` })
    return
  }
  const { name, kind, currency, targetCents, targetMonths, deadline } = req.body ?? {}
  // Each kind uses only its own target field; the other is dropped rather than stored.
  const goal = await Goal.create({
    sandbox,
    name,
    kind,
    currency,
    targetCents: kind === 'savings' ? targetCents : undefined,
    targetMonths: kind === 'emergency' ? targetMonths : undefined,
    deadline: kind === 'savings' && deadline ? deadline : undefined,
  })
  res.status(201).json(goal)
})

// Adds money to a goal, or takes it out with a negative amount. A goal cannot go below zero.
goalsRouter.post('/:id/contributions', async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!goal) {
    res.status(404).json({ error: 'Goal not found' })
    return
  }
  const { amountCents, date } = req.body ?? {}
  const saved = goal.contributions.reduce((sum, c) => sum + c.amountCents, 0)
  if (typeof amountCents === 'number' && saved + amountCents < 0) {
    res.status(400).json({ error: 'That is more than is saved in this goal' })
    return
  }
  goal.contributions.push({ amountCents, date })
  await goal.save()
  res.status(201).json(goal)
})

goalsRouter.delete('/:id', async (req, res) => {
  const deleted = await Goal.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Goal not found' })
    return
  }
  res.status(204).end()
})
