import { model, Schema } from 'mongoose'
import { CURRENCIES, DEFAULT_CURRENCY } from '../rates.ts'

/**
 * A `savings` goal has a fixed target amount. An `emergency` fund has no stored amount: its
 * target is `targetMonths` of the user's own average monthly spending, worked out when it is read.
 */
export const GOAL_KINDS = ['savings', 'emergency'] as const

const integer = { validator: Number.isInteger, message: 'must be a whole number' }

const isKind = (kind: (typeof GOAL_KINDS)[number]) =>
  function (this: { kind?: string }) {
    return this.kind === kind
  }

const contributionSchema = new Schema(
  {
    date: { type: Date, required: true },
    // In the goal's currency. Negative for a withdrawal.
    amountCents: {
      type: Number,
      required: true,
      validate: [integer, { validator: (v: number) => v !== 0, message: 'amountCents cannot be zero' }],
    },
  },
  { toJSON: { virtuals: true, versionKey: false, transform: (_doc, ret: Record<string, unknown>) => void delete ret._id } },
)

const goalSchema = new Schema(
  {
    sandbox: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: GOAL_KINDS, required: true },
    currency: { type: String, enum: CURRENCIES, default: DEFAULT_CURRENCY },
    // Set for `savings` goals, in `currency`.
    targetCents: { type: Number, min: 1, validate: integer, required: isKind('savings') },
    // Set for the `emergency` fund: how many months of spending it should cover.
    targetMonths: { type: Number, min: 1, max: 60, required: isKind('emergency') },
    // Optional calendar day (UTC midnight) to reach a savings goal by.
    deadline: Date,
    contributions: { type: [contributionSchema], default: [] },
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
goalSchema.index({ sandbox: 1 })

export const Goal = model('Goal', goalSchema)
