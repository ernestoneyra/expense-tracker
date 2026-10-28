import { createHash, randomBytes } from 'node:crypto'
import { trusted, type Types } from 'mongoose'
import { RefreshToken } from '../models/RefreshToken.ts'
import { signAccessToken } from './jwt.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** How long an access token works. Short, because it can't be taken back once issued. */
export const ACCESS_TTL_SECONDS = Number(process.env.OAUTH_ACCESS_TTL) || 15 * 60
/** A refresh token lasts this long after its last use if the person asked to stay signed in, otherwise a day. */
const PERSISTENT_REFRESH_MS = 30 * DAY
const SHORT_REFRESH_MS = DAY
/** However often it's refreshed, a sign-in ends this long after it began. */
const ABSOLUTE_MS = 90 * DAY

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')

interface Grant {
  userId: Types.ObjectId
  clientId: string
  scope: string
  familyId: string
  persistent: boolean
  familyCreatedAt: Date
  issuer: string
}

export interface Issued {
  /** The token response of RFC 6749 §5.1, without the refresh token: whether that goes in the body or a cookie is the client's setting. */
  body: {
    access_token: string
    token_type: 'Bearer'
    expires_in: number
    scope: string
  }
  refreshToken: string
  /** Seconds until the refresh token expires for a "keep me signed in" sign-in; `undefined` for one that ends with the browser. */
  refreshMaxAge: number | undefined
}

/** A new refresh token and access token. */
export async function issueTokens(grant: Grant): Promise<Issued> {
  const now = Date.now()
  const refreshToken = newToken()
  const expiresAt = new Date(
    Math.min(now + (grant.persistent ? PERSISTENT_REFRESH_MS : SHORT_REFRESH_MS), grant.familyCreatedAt.getTime() + ABSOLUTE_MS),
  )
  await RefreshToken.create({
    tokenHash: hashToken(refreshToken),
    familyId: grant.familyId,
    userId: grant.userId,
    clientId: grant.clientId,
    scope: grant.scope,
    persistent: grant.persistent,
    familyCreatedAt: grant.familyCreatedAt,
    createdAt: new Date(now),
    expiresAt,
  })
  return {
    body: {
      access_token: signAccessToken(
        { iss: grant.issuer, sub: grant.userId.toString(), scope: grant.scope, client_id: grant.clientId, fid: grant.familyId },
        ACCESS_TTL_SECONDS,
        now,
      ),
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SECONDS,
      scope: grant.scope,
    },
    refreshToken,
    refreshMaxAge: grant.persistent ? Math.floor((expiresAt.getTime() - now) / 1000) : undefined,
  }
}

/** Ends one sign-in: every refresh token descended from it stops working. */
export const revokeFamily = (familyId: string) => RefreshToken.deleteMany({ familyId })

/** Ends every sign-in of a user except one (or all of them). */
export const revokeOtherFamilies = (userId: Types.ObjectId, keepFamilyId?: string) =>
  RefreshToken.deleteMany(keepFamilyId ? { userId, familyId: trusted({ $ne: keepFamilyId }) } : { userId })
