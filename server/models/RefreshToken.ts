import { model, Schema } from 'mongoose'

// Refresh tokens are single-use: each refresh hands out a new one and retires the old (rotation). All
// the tokens that descend from one sign-in share a `familyId`, so if a retired token is ever
// presented again (it was copied) the whole family can be revoked at once. Only hashes are stored.
const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, required: true },
    scope: { type: String, required: true },
    persistent: { type: Boolean, required: true },
    // When the sign-in began: the family can't be extended past a fixed time after this.
    familyCreatedAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
    // Set when this token was used to get the next one.
    rotatedAt: { type: Date },
    // MongoDB deletes the row itself once this passes. A retired token is kept for an hour, which is
    // how long a replay of it is still recognised as one.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { versionKey: false },
)

export const RefreshToken = model('RefreshToken', refreshTokenSchema)
