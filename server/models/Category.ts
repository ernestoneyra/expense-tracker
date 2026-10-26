import { model, Schema } from 'mongoose'

// Names are unique ignoring case ("dining" and "Dining" are the same category).
export const NAME_COLLATION = { locale: 'en', strength: 2 } as const

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
  },
  {
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        return ret
      },
    },
  },
)
categorySchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION })

export const Category = model('Category', categorySchema)

const DEFAULT_CATEGORIES = [
  'Housing',
  'Groceries',
  'Dining',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Subscriptions',
  'Other',
]

// An empty collection (first run, or every category deleted) gets the defaults on startup.
export async function seedCategories() {
  if ((await Category.estimatedDocumentCount()) > 0) return
  await Category.insertMany(DEFAULT_CATEGORIES.map((name) => ({ name })))
}
