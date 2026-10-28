import type { RequestHandler } from 'express'

// Every request body and query string passes through here before a route sees it.
//
// The database is MongoDB, so the injection to worry about is not SQL but operators: a client that
// sends {"username": {"$ne": null}} where a string is expected can turn "equals this" into "is
// anything" if a handler puts the value into a query as it arrived. Handlers check their input, and
// Mongoose is configured to treat any operator in a query filter as plain data (see db.ts), but
// both depend on every future line of code getting it right. This is the layer that doesn't:
// there is no legitimate reason for a field name to look like an operator or a path, so a request
// that has one is refused whole.

/** Operators start with `$`; a `.` or a bracket makes a name a path or a nested query (`a.b`, `a[$ne]`). */
const UNSAFE_KEY = /[$.[\]]/

/** Deeper than any real request: refused rather than walked, so nesting can't be used to exhaust the stack. */
const MAX_DEPTH = 20

/** The first field name in `value`, at any depth, that is an operator or a path; `undefined` if there is none. */
export function findUnsafeKey(value: unknown): string | undefined {
  const pending: [unknown, number][] = [[value, 0]]
  while (pending.length > 0) {
    const [node, depth] = pending.pop()!
    if (typeof node !== 'object' || node === null) continue
    if (depth > MAX_DEPTH) return '(nested too deeply)'
    for (const [key, child] of Object.entries(node)) {
      // `__proto__` is how a JSON body would try to change what every object inherits.
      if (UNSAFE_KEY.test(key) || key === '__proto__') return key
      pending.push([child, depth + 1])
    }
  }
}

export const rejectOperatorKeys: RequestHandler = (req, res, next) => {
  const key = findUnsafeKey(req.body) ?? findUnsafeKey(req.query)
  if (key === undefined) return next()
  const message = 'Field names can not contain "$", "." or brackets'
  // The token endpoints answer in the form RFC 6749 asks for.
  if (req.originalUrl.startsWith('/api/oauth/')) {
    res.status(400).json({ error: 'invalid_request', error_description: message })
    return
  }
  res.status(400).json({ error: message, code: 'invalid_request' })
}
