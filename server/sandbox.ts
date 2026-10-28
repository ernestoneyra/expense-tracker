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

// Every record belongs to a "sandbox": the string stored in its `sandbox` field, which every query
// filters on. For a signed-in person it is `user:<id>` (see accountScope), so nobody can reach
// anyone else's data. With DEMO_MODE=true, visitors who don't sign in can also get a private copy of
// the demo data, keyed by a random id their browser sends in the X-Sandbox-Id header. That id is the
// only thing separating them, which is fine for a demo and not for real financial data.
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

/** Deletes everything stored for a sandbox (or several), or the single dataset outside demo mode (`null`). */
export async function wipe(sandbox: string | string[] | null) {
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

/** The sandbox of a signed-in person's data. Can't collide with an anonymous sandbox, whose id is a UUID. */
export const accountScope = (userId: { toString(): string }) => `user:${userId}`

const seedCategories = (sandbox: string) =>
  Category.insertMany(DEFAULT_CATEGORIES.map((name) => ({ sandbox, name })))

async function populate(sandbox: string) {
  await seedCategories(sandbox)
  await Expense.insertMany(demoExpenses(new Date()).map((expense) => ({ sandbox, ...expense })))
  await Budget.create({ sandbox, ...DEMO_BUDGET })
}

/** Gives a new account its starting data: the default categories, plus sample expenses for the demo accounts. */
export async function provisionAccount(sandbox: string, withSampleData: boolean) {
  await wipe(sandbox)
  await (withSampleData ? populate(sandbox) : seedCategories(sandbox))
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

/**
 * The sandbox of the current request. It is set by requireScope, which every data route sits behind;
 * if that were ever missing this throws instead of falling back to a dataset that isn't theirs.
 */
export function sandboxOf(res: Response): string {
  const sandbox: unknown = res.locals.sandbox
  if (typeof sandbox !== 'string' || !sandbox) throw new Error('Request has no data scope')
  return sandbox
}

/** Deletes all the data of a sandbox and leaves only the default categories. */
export async function clearData(sandbox: string) {
  await wipe(sandbox)
  await seedCategories(sandbox)
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
