import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Request, Response } from 'express'
import { Types, trusted } from 'mongoose'
import './db.ts' // turns on Mongoose's sanitizeFilter, as the server does
import { Budget } from './models/Budget.ts'
import { Category } from './models/Category.ts'
import { Expense } from './models/Expense.ts'
import { Recurring } from './models/Recurring.ts'
import { Session } from './models/Session.ts'
import { User } from './models/User.ts'
import { findUnsafeKey, rejectOperatorKeys } from './security.ts'

test('operators, paths, brackets and __proto__ are found at any depth', () => {
  assert.equal(findUnsafeKey({ a: 1, b: { c: [{ d: { $ne: null } }] } }), '$ne')
  assert.equal(findUnsafeKey({ 'a.b': 1 }), 'a.b')
  assert.equal(findUnsafeKey({ 'limit[$gt]': '1' }), 'limit[$gt]')
  assert.equal(findUnsafeKey({ 'tags[]': '1' }), 'tags[]')
  assert.equal(findUnsafeKey(JSON.parse('{"x":{"__proto__":{"admin":true}}}')), '__proto__')
  assert.equal(findUnsafeKey([{ $where: '1' }]), '$where')
})

test('ordinary requests, and values that merely look like operators, pass', () => {
  assert.equal(findUnsafeKey({ title: '$ne', description: 'a.b', amountCents: 5, list: [1, 'x', null, { name: 'ok' }] }), undefined)
  assert.equal(findUnsafeKey({ limit: '5', currency: 'USD' }), undefined)
  assert.equal(findUnsafeKey(undefined), undefined)
  assert.equal(findUnsafeKey(null), undefined)
  assert.equal(findUnsafeKey('$ne'), undefined)
})

test('absurd nesting is refused instead of walked', () => {
  let deep: unknown = 1
  for (let i = 0; i < 5000; i++) deep = { a: deep }
  assert.ok(findUnsafeKey(deep))
})

test('a backup file as the app writes it passes', () => {
  const backup = {
    app: 'expenser',
    version: 1,
    budget: { monthlyCents: 1, currency: 'USD', method: 'envelope' },
    categories: [{ name: 'Dining', costType: 'fixed' }],
    expenses: [{ title: 't', category: 'Dining', description: 'd', date: '2026-01-01T00:00:00.000Z', currency: 'USD', amountCents: 5 }],
    goals: [{ name: 'g', kind: 'savings', currency: 'USD', contributions: [{ date: '2026-01-01', amountCents: 1 }] }],
  }
  assert.equal(findUnsafeKey(backup), undefined)
})

function run(req: Partial<Request>) {
  let status: number | undefined
  let body: unknown
  let nexted = false
  const res = {
    status(code: number) {
      status = code
      return this
    },
    json(value: unknown) {
      body = value
    },
  } as unknown as Response
  rejectOperatorKeys({ originalUrl: '/api/x', query: {}, body: undefined, ...req } as Request, res, () => {
    nexted = true
  })
  return { status, body, nexted }
}

test('the middleware answers 400 and stops, and lets clean requests through', () => {
  assert.deepEqual(run({ body: { username: { $ne: null } } }), { status: 400, body: { error: 'Field names can not contain "$", "." or brackets', code: 'invalid_request' }, nexted: false })
  assert.equal(run({ query: { 'currency[$ne]': 'USD' } }).status, 400)
  assert.equal(run({ body: { title: 'ok' }, query: { limit: '5' } }).nexted, true)
  // the token endpoints use the error shape RFC 6749 asks for
  const oauth = run({ originalUrl: '/api/oauth/token', body: { grant_type: { $ne: null } } })
  assert.equal(oauth.status, 400)
  assert.equal((oauth.body as { error: string }).error, 'invalid_request')
})

// ---- the second layer: what Mongoose does with an operator that reaches a query anyway

interface Preparable {
  _castConditions: () => void
  error: () => Error | null
  getFilter: () => object
}

/**
 * Runs the step Mongoose performs on a filter just before it is sent to the database (sanitizing it, then
 * casting it to the schema), and returns the reason the query would be refused, if it would be. `_castConditions`
 * is internal, but it is exactly what `exec()` calls first, and this needs no database.
 */
function refusal(query: unknown): string | undefined {
  const q = query as Preparable
  try {
    q._castConditions()
  } catch (err) {
    return (err as Error).message
  }
  return q.error()?.message
}

test('with sanitizeFilter, a request value can not become a query operator', () => {
  for (const operator of [{ $ne: null }, { $gt: '' }, { $regex: '.*' }, { $in: ['a'] }, { $exists: true }, { $where: '1' }]) {
    assert.match(refusal(Category.find({ name: operator })) ?? '', /Cast to string failed/, JSON.stringify(operator))
    assert.match(refusal(User.findOne({ usernameKey: operator })) ?? '', /Cast to string failed/, JSON.stringify(operator))
    assert.match(refusal(Expense.deleteMany({ sandbox: operator })) ?? '', /Cast to string failed/, JSON.stringify(operator))
    assert.match(refusal(Expense.findOneAndDelete({ _id: operator, sandbox: 's' })) ?? '', /Cast to ObjectId failed/, JSON.stringify(operator))
  }
})

test('a whole operator filter built from a request, such as $where, is refused outright', () => {
  assert.match(refusal(Budget.findOne({ $where: 'sleep(1000)' })) ?? '', /\$where is not allowed/)
})

test('plain values, including null, still work as filters', () => {
  assert.equal(refusal(Category.find({ sandbox: 'user:1', name: 'Dining' })), undefined)
  assert.equal(refusal(Expense.find({ sandbox: null })), undefined)
})

test('the filters the app writes itself, marked trusted, still work', () => {
  assert.equal(refusal(Expense.deleteMany({ sandbox: trusted({ $in: ['a', 'b'] }) })), undefined)
  assert.equal(refusal(Session.deleteMany({ userId: new Types.ObjectId(), _id: trusted({ $ne: new Types.ObjectId() }) })), undefined)
  assert.equal(refusal(Recurring.find({ sandbox: 's', nextDue: trusted({ $lte: new Date() }) })), undefined)
  assert.equal(refusal(User.findOne({ identities: trusted({ $elemMatch: { provider: 'google', subject: '1' } }) })), undefined)
  // ...and without trusted() the same filters are refused, which is how a missed one would show up
  assert.match(refusal(Expense.deleteMany({ sandbox: { $in: ['a'] } })) ?? '', /Cast to string failed/)
})
