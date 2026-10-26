import express, { type ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import { connectDb } from './db.ts'
import { seedCategories } from './models/Category.ts'
import { budgetRouter } from './routes/budget.ts'
import { categoriesRouter } from './routes/categories.ts'
import { expensesRouter } from './routes/expenses.ts'
import { summaryRouter } from './routes/summary.ts'

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1
  res.status(connected ? 200 : 503).json({ ok: connected, db: mongoose.connection.name })
})

app.use('/api/expenses', expensesRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/budget', budgetRouter)
app.use('/api/summary', summaryRouter)

// Bad input (validation / malformed ids) is the client's fault; anything else is a 500.
// Express identifies error handlers by their 4-argument signature, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: err.message })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
app.use(errorHandler)

const port = Number(process.env.PORT) || 3001

try {
  await connectDb()
  await seedCategories()
} catch (err) {
  console.error('Failed to connect to MongoDB:', err instanceof Error ? err.message : err)
  process.exit(1)
}

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
