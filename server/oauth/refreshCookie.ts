import type { Request, Response } from 'express'
import { clearCookie, cookiesOf, setCookie } from '../auth/cookies.ts'

// For a client that takes its refresh token in a cookie (see clients.ts). The cookie is HttpOnly, so
// scripts in the page can't read it; Strict, so the browser never sends it with a request that began
// on another site; and limited to the OAuth endpoints, which are the only ones that need it. The
// browser attaches it to the token request by itself, so the app never handles the token at all.

export const REFRESH_COOKIE = 'expenser_refresh'
const PATH = '/api/oauth'

export const readRefreshCookie = (req: Request) => cookiesOf(req)[REFRESH_COOKIE]

/** `maxAge` in seconds for a "keep me signed in" sign-in; without it the cookie ends with the browser. */
export function setRefreshCookie(req: Request, res: Response, token: string, maxAge: number | undefined) {
  setCookie(req, res, REFRESH_COOKIE, token, { path: PATH, sameSite: 'Strict', maxAge })
}

export const clearRefreshCookie = (req: Request, res: Response) => clearCookie(req, res, REFRESH_COOKIE, PATH, 'Strict')
