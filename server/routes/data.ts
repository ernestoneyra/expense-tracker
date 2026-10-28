import { Router, type Response } from 'express'
import type { Document } from 'mongoose'
import { Budget } from '../models/Budget.ts'
import { Category } from '../models/Category.ts'
import { CategoryBudget } from '../models/CategoryBudget.ts'
import { Debt } from '../models/Debt.ts'
import { Expense } from '../models/Expense.ts'
import { Goal } from '../models/Goal.ts'
import { Income } from '../models/Income.ts'
import { Recurring } from '../models/Recurring.ts'
import { DEFAULT_CURRENCY, type Currency } from '../rates.ts'
import { clearData, DEMO_MODE, MAX_CATEGORIES, MAX_EXPENSES, MAX_RECORDS, sandboxOf, wipe } from '../sandbox.ts'

export const dataRouter = Router()

/** Marks a backup file as ours, and which layout of the data it uses. */
const BACKUP_APP = 'expenser'
const BACKUP_VERSION = 1

const stamp = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

const BUDGET_FIELDS = ['monthlyCents', 'currency', 'method', 'needsPercent', 'wantsPercent', 'savingsPercent']

const newestFirst = { date: -1, _id: -1 } as const

// Everything in the current dataset, in the shape /import reads back.
dataRouter.get('/export', async (_req, res) => {
  const sandbox = sandboxOf(res)
  const [budget, categories, expenses, income, categoryBudgets, goals, debts, recurring] = await Promise.all([
    Budget.findOne({ sandbox }).lean(),
    Category.find({ sandbox }).sort({ name: 1 }),
    Expense.find({ sandbox }).sort(newestFirst),
    Income.find({ sandbox }).sort(newestFirst),
    CategoryBudget.find({ sandbox }),
    Goal.find({ sandbox }),
    Debt.find({ sandbox }),
    Recurring.find({ sandbox }),
  ])
  res.attachment(`expenser-backup-${stamp()}.json`)
  res.json({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    budget: budget ? pick(budget as Record<string, unknown>, BUDGET_FIELDS) : null,
    categories,
    expenses,
    income,
    categoryBudgets,
    goals,
    debts,
    recurring,
  })
})

const fractionDigits = (currency: Currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2

/** Quotes a CSV cell. Text a spreadsheet would run as a formula (`=…`, `+…`) is prefixed with `'` so it stays text. */
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function sendCsv(res: Response, name: string, rows: string[][]) {
  res.attachment(`expenser-${name}-${stamp()}.csv`)
  res.type('text/csv; charset=utf-8')
  // The byte-order mark makes Excel read the file as UTF-8 (å, 日本語…).
  res.send('﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n')
}

const amountOf = (cents: number, currency: Currency) => (cents / 100).toFixed(fractionDigits(currency))

dataRouter.get('/export/expenses.csv', async (_req, res) => {
  const expenses = await Expense.find({ sandbox: sandboxOf(res) }).sort(newestFirst)
  sendCsv(res, 'expenses', [
    ['date', 'title', 'category', 'description', 'amount', 'currency'],
    ...expenses.map((e) => {
      const currency = e.currency ?? DEFAULT_CURRENCY
      return [e.date.toISOString().slice(0, 10), e.title, e.category, e.description ?? '', amountOf(e.amountCents, currency), currency]
    }),
  ])
})

dataRouter.get('/export/income.csv', async (_req, res) => {
  const income = await Income.find({ sandbox: sandboxOf(res) }).sort(newestFirst)
  sendCsv(res, 'income', [
    ['date', 'title', 'amount', 'currency'],
    ...income.map((i) => {
      const currency = i.currency ?? DEFAULT_CURRENCY
      return [i.date.toISOString().slice(0, 10), i.title, amountOf(i.amountCents, currency), currency]
    }),
  ])
})

// ---------------------------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------------------------

class BadBackup extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Only the listed fields: ids, the sandbox and anything unknown in a file are never trusted. */
const pick = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]]))

/** A list of `{date, amountCents}` entries (goal contributions, debt payments). */
const pickEntries = (row: Record<string, unknown>, key: string) => {
  const entries = row[key]
  return {
    [key]: Array.isArray(entries) ? entries.map((e) => (isRecord(e) ? pick(e, ['date', 'amountCents']) : e)) : entries,
  }
}

interface Section {
  count: number
  insert: () => Promise<unknown>
}

/** Checks every row of one list against its model, and returns what to insert once all lists are valid. */
function prepare<D extends Document>(
  label: string,
  rows: unknown,
  max: number,
  make: (doc: Record<string, unknown>) => D,
  fields: (row: Record<string, unknown>) => Record<string, unknown>,
  insert: (docs: D[]) => Promise<unknown>,
  sandbox: string | null,
): Section {
  if (rows === undefined || rows === null) rows = []
  if (!Array.isArray(rows)) throw new BadBackup(`"${label}" must be a list`)
  if (DEMO_MODE && rows.length > max) throw new BadBackup(`The demo can hold at most ${max} of "${label}"`)

  const docs = rows.map((row, i) => {
    if (!isRecord(row)) throw new BadBackup(`${label}[${i}] must be an object`)
    const doc = make({ ...fields(row), sandbox })
    const error = doc.validateSync()
    if (error) throw new BadBackup(`${label}[${i}]: ${error.message}`)
    return doc
  })
  return { count: docs.length, insert: () => insert(docs) }
}

/** Names are unique ignoring case within a dataset, like the indexes require. */
function assertUnique(label: string, rows: unknown, field: string) {
  if (!Array.isArray(rows)) return
  const seen = new Set<string>()
  for (const row of rows) {
    const value = isRecord(row) && typeof row[field] === 'string' ? row[field].trim().toLowerCase() : undefined
    if (value === undefined) continue
    if (seen.has(value)) throw new BadBackup(`"${label}" lists "${value}" more than once`)
    seen.add(value)
  }
}

// Replaces the current data with a backup. Every row is checked before anything is deleted, so a
// bad file changes nothing.
dataRouter.post('/import', async (req, res) => {
  const sandbox = sandboxOf(res)
  const file: unknown = req.body
  if (!isRecord(file) || file.app !== BACKUP_APP) {
    res.status(400).json({ error: 'This is not an Expenser backup file' })
    return
  }
  if (file.version !== BACKUP_VERSION) {
    res.status(400).json({ error: `Unsupported backup version: ${String(file.version)}` })
    return
  }

  let sections: Record<string, Section>
  try {
    assertUnique('categories', file.categories, 'name')
    assertUnique('categoryBudgets', file.categoryBudgets, 'category')
    sections = {
      budget: prepare(
        'budget',
        file.budget ? [file.budget] : [],
        1,
        (d) => new Budget(d),
        (row) => pick(row, BUDGET_FIELDS),
        (docs) => Budget.insertMany(docs),
        sandbox,
      ),
      categories: prepare(
        'categories',
        file.categories,
        MAX_CATEGORIES,
        (d) => new Category(d),
        (row) => pick(row, ['name', 'costType', 'necessity']),
        (docs) => Category.insertMany(docs),
        sandbox,
      ),
      expenses: prepare(
        'expenses',
        file.expenses,
        MAX_EXPENSES,
        (d) => new Expense(d),
        (row) => pick(row, ['title', 'category', 'description', 'date', 'currency', 'amountCents']),
        (docs) => Expense.insertMany(docs),
        sandbox,
      ),
      income: prepare(
        'income',
        file.income,
        MAX_RECORDS,
        (d) => new Income(d),
        (row) => pick(row, ['title', 'date', 'currency', 'amountCents']),
        (docs) => Income.insertMany(docs),
        sandbox,
      ),
      categoryBudgets: prepare(
        'categoryBudgets',
        file.categoryBudgets,
        MAX_RECORDS,
        (d) => new CategoryBudget(d),
        (row) => pick(row, ['category', 'limitCents', 'currency']),
        (docs) => CategoryBudget.insertMany(docs),
        sandbox,
      ),
      goals: prepare(
        'goals',
        file.goals,
        MAX_RECORDS,
        (d) => new Goal(d),
        (row) => ({
          ...pick(row, ['name', 'kind', 'currency', 'targetCents', 'targetMonths', 'deadline']),
          ...pickEntries(row, 'contributions'),
        }),
        (docs) => Goal.insertMany(docs),
        sandbox,
      ),
      debts: prepare(
        'debts',
        file.debts,
        MAX_RECORDS,
        (d) => new Debt(d),
        (row) => ({
          ...pick(row, ['name', 'currency', 'startingBalanceCents', 'balanceCents', 'aprPercent', 'minPaymentCents']),
          ...pickEntries(row, 'payments'),
        }),
        (docs) => Debt.insertMany(docs),
        sandbox,
      ),
      recurring: prepare(
        'recurring',
        file.recurring,
        MAX_RECORDS,
        (d) => new Recurring(d),
        (row) => pick(row, ['kind', 'title', 'category', 'currency', 'amountCents', 'frequency', 'nextDue', 'anchorDay', 'active']),
        (docs) => Recurring.insertMany(docs),
        sandbox,
      ),
    }
  } catch (err) {
    if (!(err instanceof BadBackup)) throw err
    res.status(400).json({ error: err.message })
    return
  }

  await wipe(sandbox)
  await Promise.all(Object.values(sections).map((section) => section.insert()))
  res.json({ imported: Object.fromEntries(Object.entries(sections).map(([key, s]) => [key, s.count])) })
})

// ---------------------------------------------------------------------------------------------
// Delete everything
// ---------------------------------------------------------------------------------------------

dataRouter.delete('/', async (_req, res) => {
  await clearData(sandboxOf(res))
  res.status(204).end()
})
