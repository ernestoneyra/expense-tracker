import { model, Schema } from 'mongoose'

// One row per signed-in browser. The cookie holds a random token; only its SHA-256 is stored, so a
// copy of the database can't be used to sign in.
const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // "Keep me signed in" sessions last longer and outlive the browser.
    persistent: { type: Boolean, required: true },
    createdAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    // MongoDB deletes the row itself once this passes.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    userAgent: { type: String, maxlength: 300 },
  },
  { versionKey: false },
)

export const Session = model('Session', sessionSchema)
