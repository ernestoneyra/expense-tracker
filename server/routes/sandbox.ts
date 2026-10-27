import { Router } from 'express'
import { resetSandbox, sandboxOf } from '../sandbox.ts'

export const sandboxRouter = Router()

// Replaces this visitor's data with a fresh copy of the demo data.
sandboxRouter.post('/reset', async (_req, res) => {
  const sandbox = sandboxOf(res)
  // No sandbox means the real, single dataset: never wipe that.
  if (!sandbox) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  await resetSandbox(sandbox)
  res.status(204).end()
})
