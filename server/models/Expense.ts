import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

// Amounts are stored as integer cents to avoid floating-point rounding.
const expenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Must name an existing Category when created (checked in the route); kept as plain text so
    // deleting a category later leaves old expenses intact.
    category: { type: String, required: true },
    // Optional free-text note; older expenses simply don't have one.
    description: { type: String, trim: true, maxlength: 500 },
    // Calendar day, stored as UTC midnight and displayed in UTC so it never shifts by timezone.
    date: { type: Date, required: true, index: true },
    // amountCents is in this currency. Expenses saved before currencies existed have no value
    // here and count as DEFAULT_CURRENCY (aggregations must use $ifNull for the same reason).
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amountCents must be a whole number' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        delete ret.createdAt
        delete ret.updatedAt
        return ret
      },
    },
  },
)

export const Expense = model('Expense', expenseSchema)
