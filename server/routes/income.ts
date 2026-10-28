import { Router } from 'express'
import { Income } from '../models/Income.ts'
import { DEMO_MODE, MAX_RECORDS, sandboxOf } from '../sandbox.ts'

export const incomeRouter = Router()

incomeRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500)
  res.json(await Income.find({ sandbox: sandboxOf(res) }).sort({ date: -1, _id: -1 }).limit(limit))
})

incomeRouter.post('/', async (req, res) => {
  const sandbox = sandboxOf(res)
  if (DEMO_MODE && (await Income.countDocuments({ sandbox })) >= MAX_RECORDS) {
    res.status(400).json({ error: `The demo is limited to ${MAX_RECORDS} income entries` })
    return
  }
  const { title, currency, date, amountCents } = req.body ?? {}
  res.status(201).json(await Income.create({ sandbox, title, currency, date, amountCents }))
})

incomeRouter.delete('/:id', async (req, res) => {
  const deleted = await Income.findOneAndDelete({ _id: req.params.id, sandbox: sandboxOf(res) })
  if (!deleted) {
    res.status(404).json({ error: 'Income not found' })
    return
  }
  res.status(204).end()
})
