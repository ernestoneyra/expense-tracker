import { Router } from 'express'
import { getRates } from '../rates.ts'

export const ratesRouter = Router()

ratesRouter.get('/', async (_req, res) => {
  const { rates, updatedAt } = await getRates()
  res.json({ base: 'USD', rates, updatedAt })
})
