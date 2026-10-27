import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

// One document per sandbox holding its monthly budget.
const budgetSchema = new Schema({
  // null outside demo mode, where there is just one budget.
  sandbox: { type: String, default: null, unique: true },
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
