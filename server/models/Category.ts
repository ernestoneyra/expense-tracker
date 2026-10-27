import { model, Schema } from 'mongoose'

// Names are unique within a sandbox, ignoring case ("dining" and "Dining" are the same category).
export const NAME_COLLATION = { locale: 'en', strength: 2 } as const

const categorySchema = new Schema(
  {
    sandbox: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 40 },
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
