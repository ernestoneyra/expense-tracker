// Retakes the README screenshots in docs/screenshots/ from a running app: 1440 x 900, English, signed in as guest1.
// The demo data has no income or category limits, so this adds some first to give the Budgets, Reports and
// Dashboard pages something to show. It resets guest1's data, so point it at a demo server, not one with real data:
//   npm run build && DEMO_MODE=true npm start     (then, in another terminal)     npm run screenshots
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { BASE, launch, ready } from './a11y/browser.mjs'

const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url))

const browser = await launch()
// launch() signs every new context in and resets the demo data, so seeding and shooting share one context.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: 'light' })

// A token for the API, obtained the way the app does it: the context already holds the sign-in cookie.
const verifier = randomBytes(32).toString('base64url')
const redirectUri = `${BASE}/auth/callback`
const authorize = await ctx.request.get(
  `${BASE}/api/oauth/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: 'expenser-web',
    redirect_uri: redirectUri,
    state: 'screenshots',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  })}`,
  { maxRedirects: 0 },
)
const code = new URL(authorize.headers().location ?? BASE).searchParams.get('code')
const token = await ctx.request.post(`${BASE}/api/oauth/token`, {
  form: { grant_type: 'authorization_code', client_id: 'expenser-web', code: code ?? '', redirect_uri: redirectUri, code_verifier: verifier },
})
if (!token.ok()) throw new Error(`Could not get an access token (${token.status()}).`)
const headers = { authorization: `Bearer ${(await token.json()).access_token}` }

const api = async (method, path, data) => {
  const res = await ctx.request.fetch(`${BASE}/api${path}`, { method, headers, data })
  if (!res.ok()) throw new Error(`${method} ${path} failed (${res.status()}): ${await res.text()}`)
}

// Income this month and last month; nothing before that, so the oldest month in Reports stays empty.
const now = new Date()
const firstOfMonth = (monthsBack) => new Date(Date.UTC(now.getFullYear(), now.getMonth() - monthsBack, 1, 12)).toISOString()
for (const [title, monthsBack, amountCents] of [
  ['Salary', 0, 420000],
  ['Freelance project', 0, 22000],
  ['Salary', 1, 420000],
  ['Refund', 1, 5000],
]) {
  await api('POST', '/income', { title, currency: 'USD', date: firstOfMonth(monthsBack), amountCents })
}

// A few category limits, kept under the monthly budget so no over-budget warning crowds the page.
for (const [category, limitCents] of [['Entertainment', 15000], ['Groceries', 25000], ['Dining', 10000], ['Transport', 8000]]) {
  await api('PUT', '/budget/categories', { category, limitCents, currency: 'USD' })
}

const shoot = async (route, file, theme) => {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/#/${route}`)
  await page.evaluate((t) => localStorage.setItem('expenser-theme', t), theme)
  await page.reload()
  await ready(page)
  if (route === 'reports') {
    await page.getByRole('button', { name: '3 months' }).click()
    await ready(page)
  }
  await page.waitForTimeout(400) // let transitions settle
  await page.screenshot({ path: `${OUT}${file}.png` })
  await page.close()
  console.log('saved', `docs/screenshots/${file}.png`)
}

await shoot('dashboard', 'dashboard', 'light')
await shoot('budgets', 'budgets', 'light')
await shoot('reports', 'reports', 'light')
await shoot('categories', 'categories', 'light')
await shoot('help', 'help', 'light')
await shoot('settings', 'settings-dark', 'dark')
await browser.close()
