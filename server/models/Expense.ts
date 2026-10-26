import { model, Schema } from 'mongoose'
import { CATEGORIES } from '../../shared/categories.ts'

// Amounts are stored as integer cents to avoid floating-point rounding.
const expenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: CATEGORIES },
    // Calendar day, stored as UTC midnight and displayed in UTC so it never shifts by timezone.
    date: { type: Date, required: true, index: true },
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
