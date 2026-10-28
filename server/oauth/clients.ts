import type { Request } from 'express'
import { baseUrl } from '../auth/url.ts'

// The applications allowed to ask this server for tokens. There is one: the Expenser web app itself,
// a public client (it runs in a browser, so it can't keep a secret, and uses PKCE instead). To let
// another app in, add it here, and give it a secret and a token-endpoint check if it's a server.

export interface Client {
  id: string
  /** Where the browser may be sent back with a code, as a path on this app's own address. */
  callbackPath: string
  /**
   * Whether the refresh token travels in an HttpOnly cookie instead of the response body. A browser app
   * should: its scripts then never see the token, so a script injected into the page can't carry it
   * off. Something that isn't a browser has no cookie jar and takes it from the body.
   */
  refreshTokenInCookie: boolean
}

const CLIENTS: Record<string, Client> = {
  'expenser-web': { id: 'expenser-web', callbackPath: '/auth/callback', refreshTokenInCookie: true },
}

export const clientOf = (id: unknown): Client | undefined =>
  typeof id === 'string' && Object.hasOwn(CLIENTS, id) ? CLIENTS[id] : undefined

/** Redirect addresses must match exactly (RFC 6749 §3.1.2.3), so there is just the one. */
export const redirectUriOf = (client: Client, req: Request) => `${baseUrl(req)}${client.callbackPath}`

export const SCOPES = ['api']
