import { model, Schema } from 'mongoose'

// An authorization code (RFC 6749 §4.1): what the browser carries back from /authorize to the app,
// to be traded for tokens at /token. Only a hash is stored. A code works once and for a minute; the
// row is kept a little longer so that using it a second time is noticed and the tokens it produced
// are revoked.
const authCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    redirectUri: { type: String, required: true },
    // PKCE (RFC 7636): the SHA-256 of a secret only the app that started the request knows.
    codeChallenge: { type: String, required: true },
    scope: { type: String, required: true },
    // Whether the person ticked "keep me signed in"; decides how long the refresh token lasts.
    persistent: { type: Boolean, required: true },
    // The refresh-token family this code will start, so a replayed code can revoke it.
    familyId: { type: String, required: true },
    validUntil: { type: Date, required: true },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { versionKey: false },
)

export const AuthCode = model('AuthCode', authCodeSchema)
