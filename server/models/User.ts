import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose'

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/i

const userSchema = new Schema(
  {
    // As typed, for display. `usernameKey` is the lower-case form that must be unique.
    username: { type: String, required: true, trim: true },
    usernameKey: { type: String, required: true, unique: true },
    // Only people who signed up with a password have one; a Google or GitHub account has none.
    passwordHash: { type: String, select: false },
    // Confirmed by the provider, never typed in by the person.
    email: { type: String },
    // Which provider account(s) can sign in as this user: `subject` is the provider's own stable id.
    identities: {
      type: [new Schema({ provider: { type: String, required: true }, subject: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    // The shared demo accounts: they can't be deleted or have their password changed.
    isGuest: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
)
userSchema.index(
  { 'identities.provider': 1, 'identities.subject': 1 },
  { unique: true, partialFilterExpression: { 'identities.provider': { $exists: true } } },
)

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>

export const User = model('User', userSchema)
