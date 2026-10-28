import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

const integer = { validator: Number.isInteger, message: 'must be a whole number' }

const paymentSchema = new Schema(
  {
    date: { type: Date, required: true },
    amountCents: { type: Number, required: true, min: 1, validate: integer },
  },
  { toJSON: { virtuals: true, versionKey: false, transform: (_doc, ret: Record<string, unknown>) => void delete ret._id } },
)

// A loan or credit card. `balanceCents` is what is still owed: the user sets it when adding the
// debt and each recorded payment lowers it. Interest is not added automatically, so update the
// balance to match the statement when it differs.
const debtSchema = new Schema(
  {
    sandbox: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    startingBalanceCents: { type: Number, required: true, min: 1, validate: integer },
    balanceCents: { type: Number, required: true, min: 0, validate: integer },
    // Annual interest rate in percent.
    aprPercent: { type: Number, required: true, min: 0, max: 100 },
    minPaymentCents: { type: Number, required: true, min: 0, validate: integer },
    payments: { type: [paymentSchema], default: [] },
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
debtSchema.index({ sandbox: 1 })

export const Debt = model('Debt', debtSchema)
