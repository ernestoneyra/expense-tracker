import { Router } from 'express'
import { simulatePayoff, STRATEGIES } from '../debtPlan.ts'
import { Debt } from '../models/Debt.ts'
import { converterTo, currencyParam, monthStart } from '../money.ts'
import { describeDebts } from '../planning.ts'
import { DEMO_MODE, MAX_RECORDS, sandboxOf } from '../sandbox.ts'

export const debtsRouter = Router()

// Debts plus the payoff plan for each strategy, in the `currency` query parameter. `extra` is how
// much more than the minimums the user would pay each month, in that currency's cents.
debtsRouter.get('/', async (req, res) => {
  const currency = currencyParam(req, res)
  if (!currency) return
  const extraCents = Number(req.query.extra ?? 0)
  if (!Number.isInteger(extraCents) || extraCents < 0) {
    res.status(400).json({ error: 'extra must be a whole number of cents, zero or more' })
    return
  }
  const now = new Date()
  const debts = await describeDebts(sandboxOf(res), converterTo(currency), monthStart(now), monthStart(now, 1))
  const plan = Object.fromEntries(
    STRATEGIES.map((strategy) => [strategy, simulatePayoff(debts, extraCents, strategy)]),
  )
  res.json({ currency, extraCents, debts, plan })
})

debtsRouter.post('/', async (req, res) => {
  const sandbox = sandboxOf(res)
  if (DEMO_MODE && (await Debt.countDocuments({ sandbox })) >= MAX_RECORDS) {
    res.status(400).json({ error: `The demo is limited to ${MAX_RECORDS} debts` })
    return
  }
  const { name, currency, balanceCents, aprPercent, minPaymentCents } = req.body ?? {}
  const debt = await Debt.create({
    sandbox,
    name,
    currency,
    startingBalanceCents: balanceCents,
    balanceCents,
    aprPercent,
    minPaymentCents,
  })
  res.status(201).json(debt)
})

// Corrects the balance, rate or minimum payment, e.g. to match the latest statement.
debtsRouter.patch('/:id', async (req, res) => {
  const { balanceCents, aprPercent, minPaymentCents } = req.body ?? {}
  const debt = await Debt.findOneAndUpdate(
    { _id: req.params.id, sandbox: sandboxOf(res) },
    { balanceCents, aprPercent, minPaymentCents },
    { returnDocument: 'after', runValidators: true },
  )
  if (!debt) {
    res.status(404).json({ error: 'Debt not found' })
    return
  }
  res.json(debt)
})

// Records a payment and lowers the balance by it.
debtsRouter.post('/:id/payments', async (req, res) => {
  const debt = await Debt.findOne({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!debt) {
    res.status(404).json({ error: 'Debt not found' })
    return
  }
  const { amountCents, date } = req.body ?? {}
  // Interest is not added automatically, so a payment above the recorded balance means the balance
  // is out of date. Ask for it to be corrected rather than counting money that did not reduce the debt.
  if (typeof amountCents === 'number' && amountCents > debt.balanceCents) {
    res.status(400).json({ error: 'That is more than the balance. Update the balance to match your statement first.' })
    return
  }
  debt.payments.push({ amountCents, date })
  if (typeof amountCents === 'number') debt.balanceCents -= amountCents
  await debt.save()
  res.status(201).json(debt)
})

debtsRouter.delete('/:id', async (req, res) => {
  const deleted = await Debt.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Debt not found' })
    return
  }
  res.status(204).end()
})
