import type { RequestHandler } from 'express'
import { trusted } from 'mongoose'
import { Expense } from './models/Expense.ts'
import { Income } from './models/Income.ts'
import { Recurring, type Frequency } from './models/Recurring.ts'
import { daysInMonth } from './money.ts'
import { DEMO_MODE, MAX_EXPENSES, sandboxOf } from './sandbox.ts'

/** A bill that was never opened for years still only catches up this many occurrences at a time. */
const MAX_CATCH_UP = 400

/** The next time something due on `date` falls due, as UTC midnight. */
export function advance(date: Date, frequency: Frequency, anchorDay: number) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  if (frequency === 'weekly') return new Date(Date.UTC(y, m, date.getUTCDate() + 7))
  const [ny, nm] = frequency === 'monthly' ? [y, m + 1] : [y + 1, m]
  // Normalise the month first so the length check below sees the real target month (Dec + 1 → Jan).
  const target = new Date(Date.UTC(ny, nm, 1))
  const day = Math.min(anchorDay, daysInMonth(target.getUTCFullYear(), target.getUTCMonth()))
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day))
}

/** Roughly how much a recurring amount costs (or brings in) per month. */
export const monthlyFactor: Record<Frequency, number> = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }

/**
 * Turns everything that has fallen due into real expense / income entries and moves it to its next
 * date. Runs lazily when the data is read rather than on a timer, so nothing needs a scheduler. An
 * occurrence is claimed by moving `nextDue` only if it is still unchanged, so two requests racing
 * on the same item cannot both create the entry.
 */
export async function processRecurring(sandbox: string | null, now = new Date()) {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const items = await Recurring.find({ sandbox, active: true, nextDue: trusted({ $lte: today }) })
  if (items.length === 0) return

  let expenseCount = DEMO_MODE ? await Expense.countDocuments({ sandbox }) : 0
  for (const item of items) {
    let due = item.nextDue
    for (let i = 0; i < MAX_CATCH_UP && due <= today; i++) {
      if (item.kind === 'expense' && DEMO_MODE && expenseCount >= MAX_EXPENSES) break
      const next = advance(due, item.frequency, item.anchorDay)
      const claimed = await Recurring.findOneAndUpdate(
        { _id: item._id, active: true, nextDue: due },
        { nextDue: next },
      )
      if (!claimed) break
      const entry = { sandbox, title: item.title, currency: item.currency, date: due, amountCents: item.amountCents }
      if (item.kind === 'expense') {
        await Expense.create({ ...entry, category: item.category ?? undefined })
        expenseCount++
      } else {
        await Income.create(entry)
      }
      due = next
    }
  }
}

/** Brings recurring items up to date before the routes that read expenses, income or budgets run. */
export const recurringMiddleware: RequestHandler = async (req, res, next) => {
  if (req.method === 'GET') await processRecurring(sandboxOf(res))
  next()
}
