import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const
export type Frequency = (typeof FREQUENCIES)[number]

const RECURRING_KINDS = ['expense', 'income'] as const

// A bill, subscription or paycheck that repeats. When `nextDue` arrives the server turns it into a
// real expense or income entry and moves `nextDue` forward (see recurring.ts).
const recurringSchema = new Schema(
  {
    sandbox: { type: String, default: null },
    kind: { type: String, enum: RECURRING_KINDS, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Required for expenses (checked in the route); unused for income.
    category: { type: String },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'amountCents must be a whole number' },
    },
    frequency: { type: String, enum: FREQUENCIES, required: true },
    // Next calendar day (UTC midnight) it falls due.
    nextDue: { type: Date, required: true },
    // Day of the month it was first set for, so a bill on the 31st returns to the 31st after a short month.
    anchorDay: { type: Number, required: true, min: 1, max: 31 },
    active: { type: Boolean, default: true },
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
recurringSchema.index({ sandbox: 1, nextDue: 1 })

export const Recurring = model('Recurring', recurringSchema)
