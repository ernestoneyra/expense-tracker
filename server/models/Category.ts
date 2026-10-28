import { model, Schema } from 'mongoose'

// Names are unique within a sandbox, ignoring case ("dining" and "Dining" are the same category).
export const NAME_COLLATION = { locale: 'en', strength: 2 } as const

/** Whether a category's cost is the same every month (rent) or varies (groceries). */
const COST_TYPES = ['fixed', 'variable'] as const
/** Needs vs wants, for the 50/30/20 split. */
const NECESSITIES = ['need', 'want'] as const

const categorySchema = new Schema(
  {
    sandbox: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // Both are optional and start unset: they are the user's call, and the budget views report
    // whatever is still unclassified.
    costType: { type: String, enum: COST_TYPES },
    necessity: { type: String, enum: NECESSITIES },
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
categorySchema.index({ sandbox: 1, name: 1 }, { unique: true, collation: NAME_COLLATION })

export const Category = model('Category', categorySchema)
