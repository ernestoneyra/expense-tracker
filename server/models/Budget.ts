import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

/**
 * How the month's money is planned:
 * - envelope: a spending limit per category
 * - split: share income between needs, wants and savings by percentage (e.g. 50/30/20)
 * - zeroBased: give every unit of income a job until nothing is left unassigned
 * - payFirst: set the savings share aside first and spend what remains
 */
export const BUDGET_METHODS = ['envelope', 'split', 'zeroBased', 'payFirst'] as const

const percent = { type: Number, min: 0, max: 100 }

// One document per sandbox holding its monthly budget.
const budgetSchema = new Schema({
  // null outside demo mode, where there is just one budget.
  sandbox: { type: String, default: null, unique: true },
  // Zero until the user sets one; the dashboard reads zero as "no budget set".
  monthlyCents: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: { validator: Number.isInteger, message: 'monthlyCents must be a whole number' },
  },
  // monthlyCents is in this currency; a budget saved before currencies existed counts as the default.
  currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
  method: { type: String, enum: BUDGET_METHODS, default: 'envelope' },
  // Used by `split` (all three) and `payFirst` (savings only).
  needsPercent: percent,
  wantsPercent: percent,
  savingsPercent: percent,
})

export const Budget = model('Budget', budgetSchema)
