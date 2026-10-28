import type { Request } from 'express'

/**
 * Where this app is reached from: APP_URL if set, otherwise the address the browser used. It is the
 * token issuer, and the base of the redirect addresses registered with Google and GitHub.
 */
export function baseUrl(req: Request) {
  const configured = process.env.APP_URL?.replace(/\/+$/, '')
  return configured ?? `${req.protocol}://${req.get('host')}`
}
