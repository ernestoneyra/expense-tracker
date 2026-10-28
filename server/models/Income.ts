import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

// Money coming in. Shaped like an expense (integer cents in its own currency, a calendar day
// stored at UTC midnight) but with a free-text source instead of a category.
const incomeSchema = new Schema(
  {
    sandbox: { type: String, default: null },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    date: { type: Date, required: true },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amountCents must be a whole number' },
    },
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
incomeSchema.index({ sandbox: 1, date: -1 })

export const Income = model('Income', incomeSchema)
