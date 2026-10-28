import { chromium } from 'playwright-core'

/** Where the app is running. Start it with demo data first: `npm run build && DEMO_MODE=true npm start`. */
export const BASE = process.env.BASE ?? 'http://localhost:5181'

/** The demo account every page is audited as; see SEED_GUESTS in the README. */
const ACCOUNT = { username: 'guest1', password: 'password' }

/**
 * Signs a browser context in as the demo account and puts its sample data back, so every context
 * starts from the same state the old per-visitor sandboxes gave. Needs DEMO_MODE=true for the reset.
 */
async function signIn(context) {
  const login = await context.request.post(`${BASE}/api/auth/login`, { data: ACCOUNT })
  if (!login.ok()) throw new Error(`Could not sign in as ${ACCOUNT.username} (${login.status()}). Is the server running, and SEED_GUESTS not false?`)
  const reset = await context.request.post(`${BASE}/api/sandbox/reset`)
  if (!reset.ok()) throw new Error(`Could not reset the demo data (${reset.status()}). Start the server with DEMO_MODE=true.`)
}

/**
 * Uses the Chrome that is installed; set CHROME_PATH to point at a specific browser binary instead.
 * Every context it creates is signed in, unless it is made with `{ signedOut: true }` (to test the sign-in page).
 */
export async function launch() {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
  )
  const newContext = browser.newContext.bind(browser)
  browser.newContext = async ({ signedOut = false, ...options } = {}) => {
    const context = await newContext(options)
    if (!signedOut) await signIn(context)
    return context
  }
  return browser
}

export const ROUTES = ['dashboard', 'expenses', 'income', 'categories', 'budgets', 'recurring', 'goals', 'debts', 'reports', 'settings', 'help']

/** Waits until the page has stopped loading data. */
export async function ready(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => !document.body.innerText.includes('Loading…'), null, { timeout: 15000 }).catch(() => {})
}
