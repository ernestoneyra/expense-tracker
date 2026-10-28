import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import { loadAuth, noStore, requireScope, sameOriginOnly, securityHeaders } from './auth/middleware.ts'
import { seedGuests } from './auth/seed.ts'
import { connectDb } from './db.ts'
import { Budget } from './models/Budget.ts'
import { Category } from './models/Category.ts'
import { CategoryBudget } from './models/CategoryBudget.ts'
import { Debt } from './models/Debt.ts'
import { Expense } from './models/Expense.ts'
import { Goal } from './models/Goal.ts'
import { Income } from './models/Income.ts'
import { Recurring } from './models/Recurring.ts'
import { Session } from './models/Session.ts'
import { User } from './models/User.ts'
import { authRouter } from './routes/auth.ts'
import { budgetRouter } from './routes/budget.ts'
import { categoriesRouter } from './routes/categories.ts'
import { dataRouter } from './routes/data.ts'
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
import { DEMO_MODE, startSandboxCleanup } from './sandbox.ts'

const app = express()
app.disable('x-powered-by')
// Behind a reverse proxy (Render, nginx, a load balancer) the address and protocol the browser used
// are in X-Forwarded-* headers. Trusting them without a proxy would let anyone fake their address
// and skip the sign-in rate limits, so it's opt-in: TRUST_PROXY=1 for one proxy in front.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY)
  app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY)
}
app.use(securityHeaders)
app.use('/api', sameOriginOnly)
// A backup is far bigger than the 100 kB default allows, so only people who are signed in may
// send a body that large. Body parsers skip a body that is already parsed, so this must come first;
// every other route keeps the default limit.
app.use('/api/data', loadAuth, requireScope, express.json({ limit: '10mb' }))
app.use(express.json())

app.get('/api/health', noStore, (_req, res) => {
  const connected = mongoose.connection.readyState === 1
  res.status(connected ? 200 : 503).json({ ok: connected, db: mongoose.connection.name, demo: DEMO_MODE })
})

app.use('/api', loadAuth)
app.use('/api/auth', authRouter)
// Exchange rates are the same for everyone, so reading them needs no account (the app loads them
// before anyone has signed in). Asking the provider for fresh ones does.
app.use('/api/rates', (req, res, next) => (req.method === 'GET' ? next() : requireScope(req, res, next)), ratesRouter)

// Everything below is one person's data, so it needs to know whose: an account, or in a hosted
// demo a private sandbox. Outside demo mode there are no sandboxes, and the reset route must not
// exist for it to be reachable.
app.use('/api', noStore, requireScope)
if (DEMO_MODE) app.use('/api/sandbox', sandboxRouter)
// Bills and paychecks that have fallen due become real entries before anything reads them.
app.use(
  ['/api/expenses', '/api/income', '/api/budget', '/api/summary', '/api/goals', '/api/debts', '/api/recurring', '/api/reports'],
  recurringMiddleware,
)
app.use('/api/expenses', expensesRouter)
app.use('/api/income', incomeRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/data', dataRouter)
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
  // The body parser's own errors: a malformed or oversized request body.
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'That file is too large' })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request is not valid JSON' })
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
    [Budget, Category, CategoryBudget, Debt, Expense, Goal, Income, Recurring, User, Session].map((m) => m.syncIndexes()),
  )
  await seedGuests()
} catch (err) {
  console.error('Failed to connect to MongoDB:', err instanceof Error ? err.message : err)
  process.exit(1)
}

app.listen(port, () => console.log(`API listening on http://localhost:${port}${DEMO_MODE ? ' (demo mode)' : ''}`))
if (DEMO_MODE) startSandboxCleanup()
