import { randomBytes, sign, verify } from 'node:crypto'
import { signingKey } from './keys.ts'

// Access tokens are JWTs in the JWT profile for OAuth 2.0 access tokens (RFC 9068): a signed set of
// claims the API can check without asking the database whether the token is good.

export const AUDIENCE = 'expenser-api'

export interface AccessClaims {
  iss: string
  /** The user's id. */
  sub: string
  aud: string
  exp: number
  iat: number
  jti: string
  scope: string
  client_id: string
  /** The refresh-token family this access token came from, i.e. which sign-in it belongs to. */
  fid: string
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

export function signAccessToken(
  claims: Pick<AccessClaims, 'iss' | 'sub' | 'scope' | 'client_id' | 'fid'>,
  ttlSeconds: number,
  now = Date.now(),
): string {
  const key = signingKey()
  const iat = Math.floor(now / 1000)
  const header = encode({ alg: 'EdDSA', typ: 'at+jwt', kid: key.kid })
  const payload = encode({ ...claims, aud: AUDIENCE, iat, exp: iat + ttlSeconds, jti: randomBytes(12).toString('base64url') })
  const signature = sign(null, Buffer.from(`${header}.${payload}`), key.privateKey).toString('base64url')
  return `${header}.${payload}.${signature}`
}

/** The token's claims if it is genuine, unexpired and meant for this API; otherwise `null`. */
export function verifyAccessToken(token: string, issuer: string, now = Date.now()): AccessClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const key = signingKey()
    // Only the one algorithm and key we sign with are accepted: never what the token says to use.
    if (header.alg !== 'EdDSA' || header.typ !== 'at+jwt' || header.kid !== key.kid) return null
    if (!verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), key.publicKey, Buffer.from(parts[2], 'base64url'))) return null

    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Partial<AccessClaims>
    if (claims.iss !== issuer || claims.aud !== AUDIENCE) return null
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null
    if (typeof claims.sub !== 'string' || typeof claims.fid !== 'string') return null
    return claims as AccessClaims
  } catch {
    return null
  }
}
