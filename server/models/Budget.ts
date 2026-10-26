import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

// Single-document collection holding the monthly budget.
const budgetSchema = new Schema({
  monthlyCents: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isInteger, message: 'monthlyCents must be a whole number' },
  },
  // monthlyCents is in this currency; a budget saved before currencies existed counts as the default.
  currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
})

export const Budget = model('Budget', budgetSchema)
