import { model, Schema } from 'mongoose'

// The key access tokens are signed with, when OAUTH_SIGNING_KEY isn't set in the environment. One
// document, created by the first server to start, so every instance signs and verifies the same way.
const signingKeySchema = new Schema(
  {
    _id: { type: String, required: true },
    privateKeyPem: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false },
)

export const SigningKey = model('SigningKey', signingKeySchema)
