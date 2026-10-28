import type { RequestHandler, Response } from 'express'
import { model, Schema } from 'mongoose'
import { DEFAULT_CATEGORIES, DEMO_BUDGET, demoExpenses } from './demo.ts'
import { Budget } from './models/Budget.ts'
import { Category } from './models/Category.ts'
import { CategoryBudget } from './models/CategoryBudget.ts'
import { Debt } from './models/Debt.ts'
import { Expense } from './models/Expense.ts'
import { Goal } from './models/Goal.ts'
import { Income } from './models/Income.ts'
import { Recurring } from './models/Recurring.ts'

// With DEMO_MODE=true every visitor gets a private copy of the data, keyed by a random id their
// browser sends in the X-Sandbox-Id header. There are no accounts: the id is the only thing that
// separates one visitor's data from another's, which is fine for a demo and not for real
// financial data. Without it (local development) there is a single dataset: every query uses a
// `null` sandbox, which also matches documents saved before sandboxes existed.
export const DEMO_MODE = process.env.DEMO_MODE === 'true'

/** Per-sandbox caps so a single visitor can't fill the database. */
export const MAX_EXPENSES = 500
export const MAX_CATEGORIES = 50
/** The same cap for each of income, category limits, goals, debts and recurring items. */
export const MAX_RECORDS = 100

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const TOUCH_INTERVAL_MS = 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const sandboxSchema = new Schema(
  { _id: { type: String, required: true }, lastSeenAt: { type: Date, required: true } },
  { versionKey: false },
)
const Sandbox = model('Sandbox', sandboxSchema)

// Sandboxes this process has already set up, and when each last had its lastSeenAt written.
const lastTouched = new Map<string, number>()
// Setups in progress, so a page that fires several requests at once seeds the data only once.
const creating = new Map<string, Promise<void>>()

async function wipe(sandbox: string | string[]) {
  const filter = Array.isArray(sandbox) ? { sandbox: { $in: sandbox } } : { sandbox }
  await Promise.all([
    Expense.deleteMany(filter),
    Category.deleteMany(filter),
    Budget.deleteMany(filter),
    CategoryBudget.deleteMany(filter),
    Income.deleteMany(filter),
    Goal.deleteMany(filter),
    Debt.deleteMany(filter),
    Recurring.deleteMany(filter),
  ])
}

async function populate(sandbox: string) {
  await Category.insertMany(DEFAULT_CATEGORIES.map((name) => ({ sandbox, name })))
  await Expense.insertMany(demoExpenses(new Date()).map((expense) => ({ sandbox, ...expense })))
  await Budget.create({ sandbox, ...DEMO_BUDGET })
}

async function ensureSandbox(id: string) {
  const seen = lastTouched.get(id)
  if (seen !== undefined) {
    if (Date.now() - seen > TOUCH_INTERVAL_MS) {
      lastTouched.set(id, Date.now())
      await Sandbox.updateOne({ _id: id }, { lastSeenAt: new Date() })
    }
    return
  }

  let pending = creating.get(id)
  if (!pending) {
    pending = (async () => {
      if (!(await Sandbox.findByIdAndUpdate(id, { lastSeenAt: new Date() }))) {
        // The sandbox record is written last, so a crash half-way through seeding retries cleanly.
        await wipe(id)
        await populate(id)
        await Sandbox.create({ _id: id, lastSeenAt: new Date() })
      }
      lastTouched.set(id, Date.now())
    })().finally(() => creating.delete(id))
    creating.set(id, pending)
  }
  await pending
}

export const sandboxMiddleware: RequestHandler = async (req, res, next) => {
  const id = req.get('x-sandbox-id')?.toLowerCase()
  if (!id || !ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Missing or invalid X-Sandbox-Id header' })
    return
  }
  await ensureSandbox(id)
  res.locals.sandbox = id
  next()
}

/** The sandbox id of the current request, or `null` for the single shared dataset outside demo mode. */
export const sandboxOf = (res: Response): string | null => res.locals.sandbox ?? null

/** Outside demo mode, an empty database gets the default categories on startup. */
export async function seedLocalCategories() {
  if (await Category.exists({ sandbox: null })) return
  await Category.insertMany(DEFAULT_CATEGORIES.map((name) => ({ sandbox: null, name })))
}

/** Throws away this sandbox's data and starts it over with the demo data. */
export async function resetSandbox(id: string) {
  await wipe(id)
  await populate(id)
}

async function deleteStaleSandboxes() {
  const cutoff = new Date(Date.now() - RETENTION_MS)
  const stale = (await Sandbox.distinct('_id', { lastSeenAt: { $lt: cutoff } })) as string[]
  if (stale.length === 0) return
  // Data first: a crash in between leaves an empty sandbox rather than data nobody can reach.
  await wipe(stale)
  await Sandbox.deleteMany({ _id: { $in: stale } })
  for (const id of stale) lastTouched.delete(id)
  console.log(`Deleted ${stale.length} inactive sandbox(es)`)
}

/** Deletes sandboxes unused for a week, now and then hourly. */
export function startSandboxCleanup() {
  const run = () =>
    deleteStaleSandboxes().catch((err) =>
      console.error('Sandbox cleanup failed:', err instanceof Error ? err.message : err),
    )
  void run()
  setInterval(run, CLEANUP_INTERVAL_MS).unref()
}
