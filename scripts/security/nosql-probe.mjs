// `npm run security`: sends NoSQL-operator payloads ($ne, $gt, $regex, $where, $inc, dotted keys, arrays...)
// into every field of every endpoint, including the login, the token endpoints and the backup import, and
// reports anything that is not a clean refusal: a request that is accepted, a server error, another account's
// data leaking or changing, or a forged `sandbox` landing in someone else's data. It also checks that a real
// backup still imports. Needs the app running, with the demo accounts (guest2 is the "victim"):
//   npm start            then            npm run security      (BASE=http://localhost:PORT if not 5181)
// It registers a throwaway account to attack from, and deletes it at the end.
import { createHash, randomBytes } from 'node:crypto'

const B = process.env.BASE ?? 'http://localhost:5181'
const REDIRECT = `${B}/auth/callback`
const jarOf = () => new Map()
function device() {
  const jar = jarOf()
  return {
    get: (n) => jar.get(n),
    async fetch(path, init = {}) {
      const headers = { 'sec-fetch-site': 'same-origin', ...(init.headers ?? {}) }
      const cookie = [...jar].filter(([, c]) => new URL(path, B).pathname.startsWith(c.path)).map(([k, c]) => `${k}=${c.value}`).join('; ')
      if (cookie) headers.cookie = cookie
      const res = await fetch(B + path, { redirect: 'manual', ...init, headers })
      for (const line of res.headers.getSetCookie()) {
        const [pair, ...attrs] = line.split(';').map((s) => s.trim())
        const [name, ...v] = pair.split('=')
        if (attrs.some((a) => /^Max-Age=0$/i.test(a))) jar.delete(name)
        else jar.set(name, { value: v.join('='), path: attrs.find((a) => /^Path=/i.test(a))?.slice(5) ?? '/' })
      }
      return res
    },
  }
}
const json = (o, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) })

async function signIn(username, password) {
  const d = device()
  const l = await d.fetch('/api/auth/login', json({ username, password }))
  if (!l.ok) throw new Error('login ' + username + ' ' + l.status)
  const verifier = randomBytes(32).toString('base64url')
  const a = await d.fetch('/api/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: 'expenser-web', redirect_uri: REDIRECT, state: 's', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }))
  const code = new URL(a.headers.get('location')).searchParams.get('code')
  const t = await (await d.fetch('/api/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'expenser-web', code, redirect_uri: REDIRECT, code_verifier: verifier }) })).json()
  return { d, token: t.access_token }
}

// ---- setup: a victim with data, and an attacker with an account of their own
const victim = await signIn('guest2', 'password')
const attackerName = 'atk_' + Date.now().toString(36)
{
  const d = device()
  const r = await d.fetch('/api/auth/register', json({ username: attackerName, password: 'a long enough phrase' }))
  if (r.status !== 201) throw new Error('register ' + r.status)
}
const attacker = await signIn(attackerName, 'a long enough phrase')
const as = (who) => (path, init = {}) => who.d.fetch(path, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${who.token}` } })
const V = as(victim)
const A = as(attacker)

const snapshot = async () => {
  const out = {}
  for (const p of ['expenses', 'categories', 'income', 'goals', 'debts', 'recurring', 'budget', 'budget/categories']) {
    out[p] = await (await V('/api/' + p)).text()
  }
  return JSON.stringify(out)
}
const before = await snapshot()
const victimExpenses = await (await V('/api/expenses')).json()
const victimCategory = (await (await V('/api/categories')).json())[0]

// ---- payloads
const PAYLOADS = [
  ['{$ne:null}', { $ne: null }],
  ['{$gt:""}', { $gt: '' }],
  ['{$regex:.*}', { $regex: '.*' }],
  ['{$where}', { $where: 'sleep(1000)' }],
  ['{$inc}', { $inc: { amountCents: 1 } }],
  ['{$set}', { $set: { sandbox: 'x' } }],
  ['dotted key', { 'a.b': 1 }],
  ['[{$ne}]', [{ $ne: null }]],
]
const findings = []
let probes = 0
const note = (label, res, body) => {
  probes++
  if (res.status >= 500) findings.push(`5xx  ${res.status} ${label}`)
  else if (res.status < 300) findings.push(`ACCEPTED ${res.status} ${label}`)
  void body
}

// A valid baseline body per endpoint; each field is replaced by each payload in turn.
const today = new Date().toISOString().slice(0, 10)
const bodies = {
  'POST /expenses': { title: 't', category: 'Dining', currency: 'USD', date: today, amountCents: 100, description: 'd' },
  'POST /categories': { name: 'probe' },
  'PUT /budget': { monthlyCents: 100, currency: 'USD' },
  'PUT /budget/method': { method: 'split', needsPercent: 50, wantsPercent: 30, savingsPercent: 20 },
  'PUT /budget/categories': { category: 'Dining', limitCents: 100, currency: 'USD' },
  'POST /income': { title: 't', currency: 'USD', date: today, amountCents: 100 },
  'POST /goals': { name: 'g', kind: 'savings', currency: 'USD', targetCents: 1000, deadline: today },
  'POST /debts': { name: 'd', currency: 'USD', balanceCents: 1000, aprPercent: 5, minPaymentCents: 10 },
  'POST /recurring': { kind: 'expense', title: 't', category: 'Dining', currency: 'USD', amountCents: 100, frequency: 'monthly', startDate: today },
}
for (const [route, base] of Object.entries(bodies)) {
  const [method, path] = route.split(' ')
  for (const field of Object.keys(base)) {
    for (const [name, payload] of PAYLOADS) {
      const res = await A('/api' + path, json({ ...base, [field]: payload }, method))
      note(`${route}  ${field} = ${name}`, res)
    }
  }
}

// create real records for the attacker so :id routes can be hit with payloads in the body
const mk = async (path, body) => (await (await A('/api' + path, json(body))).json())
const goal = await mk('/goals', bodies['POST /goals'])
const debt = await mk('/debts', bodies['POST /debts'])
const rec = await mk('/recurring', bodies['POST /recurring'])
const cat = await mk('/categories', { name: 'mine' })
const idRoutes = [
  ['PATCH', `/categories/${cat.id}`, { costType: 'fixed', necessity: 'need' }],
  ['PATCH', `/debts/${debt.id}`, { balanceCents: 5, aprPercent: 1, minPaymentCents: 1 }],
  ['POST', `/debts/${debt.id}/payments`, { amountCents: 1, date: today }],
  ['POST', `/goals/${goal.id}/contributions`, { amountCents: 1, date: today }],
  ['PATCH', `/recurring/${rec.id}`, { active: false }],
]
for (const [method, path, base] of idRoutes) {
  for (const field of Object.keys(base)) {
    for (const [name, payload] of PAYLOADS) {
      note(`${method} ${path.replace(/[0-9a-f]{24}/, ':id')}  ${field} = ${name}`, await A('/api' + path, json({ ...base, [field]: payload }, method)))
    }
  }
}

// ids that are operators, not ids
for (const bad of ['%7B%22$ne%22:null%7D', '[$ne]=1', '$ne', '*', '..%2F..', '000000000000000000000000', victimExpenses[0].id]) {
  for (const [method, p] of [['DELETE', `/expenses/${bad}`], ['DELETE', `/categories/${bad}`], ['DELETE', `/goals/${bad}`], ['DELETE', `/debts/${bad}`], ['DELETE', `/income/${bad}`], ['DELETE', `/recurring/${bad}`], ['DELETE', `/budget/categories/${bad}`], ['PATCH', `/categories/${bad}`], ['PATCH', `/debts/${bad}`], ['POST', `/goals/${bad}/contributions`]]) {
    const res = await A('/api' + p, json({ costType: 'fixed', amountCents: 1 }, method))
    probes++
    // 204 (deleted) on an id that isn't the attacker's own would be a finding
    if (res.status < 300 || res.status >= 500) findings.push(`id route ${res.status} ${method} ${p}`)
  }
}

// query-string operators
for (const q of ['limit[$gt]=1', 'limit=1&limit=2', 'currency[$ne]=USD', 'currency=USD&currency=EUR', 'months[$gt]=0', 'extra[$ne]=1', 'sandbox=user:x', '$where=1']) {
  for (const path of ['/expenses', '/income', '/summary', '/reports', '/debts', '/goals', '/recurring', '/budget/overview', '/categories']) {
    const res = await A(`/api${path}?${q}`)
    probes++
    if (res.status >= 500) findings.push(`5xx ${res.status} GET ${path}?${q}`)
    const text = await res.text()
    if (res.status < 300 && victimExpenses.some((e) => text.includes(e.id))) findings.push(`LEAK victim data via GET ${path}?${q}`)
  }
}

// mass assignment: extra keys must not reach the database
{
  const r = await A('/api/expenses', json({ ...bodies['POST /expenses'], sandbox: 'user:someone-else', _id: '000000000000000000000001', createdAt: '2000-01-01', __proto__: { admin: true } }))
  probes++
  const body = await r.json()
  const mine = await (await A('/api/expenses')).json()
  const visibleToVictim = (await (await V('/api/expenses')).json()).some((e) => e.id === body.id)
  if (visibleToVictim) findings.push('MASS ASSIGNMENT: expense with a forged sandbox landed in the victim\'s data')
  if (!mine.some((e) => e.id === body.id)) findings.push('mass assignment: expense not in the attacker\'s own data either')
}

// ---- backup import with operator-laden documents
{
  const base = { app: 'expenser', version: 1, budget: null, categories: [{ name: 'Dining' }], expenses: [], income: [], categoryBudgets: [], goals: [], debts: [], recurring: [] }
  const rows = {
    expenses: { title: 't', category: 'Dining', description: 'd', date: today, currency: 'USD', amountCents: 5 },
    income: { title: 't', date: today, currency: 'USD', amountCents: 5 },
    categories: { name: 'x', costType: 'fixed', necessity: 'need' },
    goals: { name: 'g', kind: 'savings', currency: 'USD', targetCents: 100, contributions: [{ date: today, amountCents: 1 }] },
    debts: { name: 'd', currency: 'USD', startingBalanceCents: 1, balanceCents: 1, aprPercent: 1, minPaymentCents: 1, payments: [{ date: today, amountCents: 1 }] },
    recurring: { kind: 'income', title: 't', currency: 'USD', amountCents: 1, frequency: 'monthly', nextDue: today, anchorDay: 1, active: true },
    categoryBudgets: { category: 'Dining', limitCents: 1, currency: 'USD' },
  }
  for (const [section, row] of Object.entries(rows)) {
    for (const field of Object.keys(row)) {
      for (const [name, payload] of PAYLOADS) {
        const doc = { ...base, categories: section === 'categories' ? [{ ...row, [field]: payload }] : [{ name: 'Dining' }], [section]: section === 'categories' ? [{ ...row, [field]: payload }] : [{ ...row, [field]: payload }] }
        const res = await A('/api/data/import', json(doc))
        probes++
        if (res.status >= 500 || res.status < 300) findings.push(`import ${res.status} ${section}.${field} = ${name}`)
      }
    }
  }
  // a key smuggled into the document that would redirect it to another account
  const res = await A('/api/data/import', json({ ...base, expenses: [{ ...rows.expenses, sandbox: 'user:victim', _id: '000000000000000000000002' }] }))
  probes++
  const leaked = (await (await V('/api/expenses')).json()).some((e) => e.title === 't' && e.amountCents === 5)
  if (leaked) findings.push('IMPORT: a document with a forged sandbox landed in the victim\'s data')
  void res
}

// ---- authentication endpoints
{
  const d = device()
  const bypass = [
    ['login {$ne} both', { username: { $ne: null }, password: { $ne: null } }],
    ['login {$gt}', { username: { $gt: '' }, password: { $gt: '' } }],
    ['login {$regex}', { username: { $regex: '^guest' }, password: 'password' }],
    ['login username {$ne}, real password', { username: { $ne: 'zzz' }, password: 'password' }],
    ['login array', { username: ['guest1'], password: ['password'] }],
    ['login $where', { username: 'guest1', password: 'password', $where: '1' }],
  ]
  for (const [name, body] of bypass) {
    const res = await d.fetch('/api/auth/login', json(body))
    probes++
    if (res.status < 400 || res.status >= 500) findings.push(`AUTH BYPASS? ${res.status} ${name}`)
  }
  for (const [name, payload] of PAYLOADS) {
    for (const f of ['username', 'password']) {
      const res = await d.fetch('/api/auth/register', json({ username: 'okname1', password: 'a long enough phrase', [f]: payload }))
      probes++
      if (res.status < 400 || res.status >= 500) findings.push(`register ${res.status} ${f} = ${name}`)
    }
  }
  // OAuth endpoints: form bodies and JSON bodies with operators
  const tokenBodies = [
    { grant_type: 'authorization_code', client_id: { $ne: null }, code: { $ne: null }, code_verifier: 'v'.repeat(43), redirect_uri: REDIRECT },
    { grant_type: 'refresh_token', client_id: 'expenser-web', refresh_token: { $ne: null } },
    { grant_type: { $ne: null }, client_id: 'expenser-web' },
  ]
  for (const body of tokenBodies) {
    const res = await d.fetch('/api/oauth/token', json(body))
    probes++
    if (res.status < 400 || res.status >= 500) findings.push(`oauth token ${res.status} ${JSON.stringify(body).slice(0, 60)}`)
  }
  for (const body of [{ client_id: 'expenser-web', token: { $ne: null } }, { client_id: { $ne: null }, token: 'x' }]) {
    const res = await d.fetch('/api/oauth/revoke', json(body))
    probes++
    if (res.status >= 500) findings.push(`oauth revoke ${res.status}`)
  }
  for (const q of ['client_id[$ne]=1', 'client_id=expenser-web&client_id=x', 'redirect_uri[]=x&client_id=expenser-web']) {
    const res = await d.fetch('/api/oauth/authorize?' + q)
    probes++
    if (res.status >= 500) findings.push(`authorize ${res.status} ${q}`)
  }
  // a bearer token carrying an operator as its subject cannot be forged without the key, but a garbage one must not 5xx
  for (const t of ['x', 'a.b.c', '{"$ne":null}', 'e30.e30.e30']) {
    const res = await d.fetch('/api/expenses', { headers: { authorization: `Bearer ${t}` } })
    probes++
    if (res.status >= 500) findings.push(`bearer ${res.status} ${t}`)
  }
}

// ---- did anything of the victim's change? (the import above replaces the attacker's data only)
const after = await snapshot()
if (before !== after) findings.push('VICTIM DATA CHANGED during the probe')
const stillThere = (await (await V('/api/categories')).json()).some((c) => c.id === victimCategory.id)
if (!stillThere) findings.push('victim category deleted')

// ---- a real backup still goes through the guard and imports (nothing legitimate is refused)
{
  const exported = await (await V('/api/data/export')).json()
  const res = await A('/api/data/import', json(exported))
  probes++
  if (res.status !== 200) findings.push(`a real backup was refused: ${res.status} ${await res.text()}`)
  const mineAfter = await (await A('/api/expenses')).json()
  if (res.status === 200 && mineAfter.length !== exported.expenses.length) findings.push('the imported backup has the wrong number of expenses')
  const stillVictim = await (await V('/api/expenses')).json()
  if (stillVictim.length !== exported.expenses.length) findings.push('importing into one account changed the other')
}

// ---- clean up the attacker account
{
  const res = await A('/api/auth/account', json({ password: 'a long enough phrase' }, 'DELETE'))
  if (res.status !== 204) findings.push(`could not delete the probe account: ${res.status}`)
}

console.log(`${probes} probes sent`)
console.log(findings.length ? 'FINDINGS:\n' + [...new Set(findings)].join('\n') : 'no findings: every probe was refused cleanly, nothing leaked or changed')
process.exitCode = findings.length ? 1 : 0
