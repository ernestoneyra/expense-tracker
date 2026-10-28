import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'
import { NAME_COLLATION } from './Category.ts'

// A monthly spending limit for one category (the "envelope"). Like expenses, it refers to the
// category by name, so deleting the category leaves the limit in place but unused.
const categoryBudgetSchema = new Schema(
  {
    sandbox: { type: String, default: null },
    category: { type: String, required: true, trim: true },
    limitCents: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'limitCents must be a whole number' },
    },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
  },
  {
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        delete ret.sandbox
        return ret
      },
    },
  },
)
categoryBudgetSchema.index({ sandbox: 1, category: 1 }, { unique: true, collation: NAME_COLLATION })

export const CategoryBudget = model('CategoryBudget', categoryBudgetSchema)
