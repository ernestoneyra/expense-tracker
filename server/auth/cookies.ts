import type { Request, Response } from 'express'

/** The cookies a request carries. Express 5 doesn't parse them, and this is all that's needed. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const part of header?.split(';') ?? []) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (!name || name in cookies) continue
    try {
      cookies[name] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      // A value that isn't valid percent-encoding is ignored, as if it were absent.
    }
  }
  return cookies
}

export const cookiesOf = (req: Request) => parseCookies(req.headers.cookie)

/** Whether the browser reached us over HTTPS (behind a proxy, only if TRUST_PROXY is set). */
const isSecure = (req: Request) => req.secure || (process.env.APP_URL ?? '').startsWith('https://')

interface CookieOptions {
  /** Seconds; omit for a cookie that ends with the browser session. */
  maxAge?: number
  path?: string
  /** Lax is for the sign-in cookie, which must survive coming back from Google or GitHub; Strict is never sent cross-site at all. */
  sameSite?: 'Lax' | 'Strict'
}

/** Always HttpOnly, so scripts can't read it, and never sent with a cross-site POST. */
export function setCookie(req: Request, res: Response, name: string, value: string, options: CookieOptions = {}) {
  res.append(
    'Set-Cookie',
    [
      `${name}=${encodeURIComponent(value)}`,
      `Path=${options.path ?? '/'}`,
      'HttpOnly',
      `SameSite=${options.sameSite ?? 'Lax'}`,
      ...(isSecure(req) ? ['Secure'] : []),
      ...(options.maxAge === undefined ? [] : [`Max-Age=${Math.floor(options.maxAge)}`]),
    ].join('; '),
  )
}

export function clearCookie(req: Request, res: Response, name: string, path = '/', sameSite?: 'Lax' | 'Strict') {
  setCookie(req, res, name, '', { maxAge: 0, path, sameSite })
}
