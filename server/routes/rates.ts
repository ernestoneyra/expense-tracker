import { Router } from 'express'
import { getRatesStatus } from '../rates.ts'

export const ratesRouter = Router()

ratesRouter.get('/', async (_req, res) => {
  res.json({ base: 'USD', ...(await getRatesStatus()) })
})

// Asks the provider again instead of waiting for the cache to expire.
ratesRouter.post('/refresh', async (_req, res) => {
  res.json({ base: 'USD', ...(await getRatesStatus(true)) })
})
