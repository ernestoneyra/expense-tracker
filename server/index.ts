import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import { connectDb } from './db.ts'
import { Budget } from './models/Budget.ts'
import { Category } from './models/Category.ts'
import { CategoryBudget } from './models/CategoryBudget.ts'
import { Debt } from './models/Debt.ts'
import { Expense } from './models/Expense.ts'
import { Goal } from './models/Goal.ts'
import { Income } from './models/Income.ts'
import { Recurring } from './models/Recurring.ts'
import { budgetRouter } from './routes/budget.ts'
import { categoriesRouter } from './routes/categories.ts'
import { debtsRouter } from './routes/debts.ts'
import { expensesRouter } from './routes/expenses.ts'
import { goalsRouter } from './routes/goals.ts'
import { incomeRouter } from './routes/income.ts'
import { ratesRouter } from './routes/rates.ts'
import { recurringRouter } from './routes/recurring.ts'
import { reportsRouter } from './routes/reports.ts'
import { recurringMiddleware } from './recurring.ts'
import { RatesUnavailableError } from './rates.ts'
import { sandboxRouter } from './routes/sandbox.ts'
import { summaryRouter } from './routes/summary.ts'
import { DEMO_MODE, sandboxMiddleware, seedLocalCategories, startSandboxCleanup } from './sandbox.ts'

const app = express()
app.disable('x-powered-by')
app.use(express.json())

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1
  res.status(connected ? 200 : 503).json({ ok: connected, db: mongoose.connection.name, demo: DEMO_MODE })
})

app.use('/api/rates', ratesRouter)

// In demo mode everything below is private to one visitor's sandbox. Otherwise there are no sandboxes,
// and the reset route must not exist: it would wipe the real data.
if (DEMO_MODE) {
  app.use('/api', sandboxMiddleware)
  app.use('/api/sandbox', sandboxRouter)
}
// Bills and paychecks that have fallen due become real entries before anything reads them.
app.use(
  ['/api/expenses', '/api/income', '/api/budget', '/api/summary', '/api/goals', '/api/debts', '/api/recurring', '/api/reports'],
  recurringMiddleware,
)
app.use('/api/expenses', expensesRouter)
app.use('/api/income', incomeRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/budget', budgetRouter)
app.use('/api/summary', summaryRouter)
app.use('/api/goals', goalsRouter)
app.use('/api/debts', debtsRouter)
app.use('/api/recurring', recurringRouter)
app.use('/api/reports', reportsRouter)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// In production the API server also serves the built frontend, so the whole app is one process
// on one URL. In development there is no build and Vite serves the frontend instead.
const dist = path.join(import.meta.dirname, '..', 'dist')
if (existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist))
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// Bad input (validation / malformed ids) is the client's fault; anything else is a 500.
// Express identifies error handlers by their 4-argument signature, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: err.message })
    return
  }
  if (err instanceof RatesUnavailableError) {
    res.status(503).json({ error: err.message })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
app.use(errorHandler)

const port = Number(process.env.PORT) || 5181

try {
  await connectDb()
  // Drop indexes the schemas no longer define, e.g. the old global-unique category name, which
  // would otherwise stop two sandboxes from having a category with the same name.
  await Promise.all(
    [Budget, Category, CategoryBudget, Debt, Expense, Goal, Income, Recurring].map((m) => m.syncIndexes()),
  )
  if (!DEMO_MODE) await seedLocalCategories()
} catch (err) {
  console.error('Failed to connect to MongoDB:', err instanceof Error ? err.message : err)
  process.exit(1)
}

app.listen(port, () => console.log(`API listening on http://localhost:${port}${DEMO_MODE ? ' (demo mode)' : ''}`))
if (DEMO_MODE) startSandboxCleanup()
