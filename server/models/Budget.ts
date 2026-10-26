import { model, Schema } from 'mongoose'

// Single-document collection holding the monthly budget.
const budgetSchema = new Schema({
  monthlyCents: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isInteger, message: 'monthlyCents must be a whole number' },
  },
})

export const Budget = model('Budget', budgetSchema)
