import { chromium } from 'playwright-core'

/** Where the app is running. Start it with demo data first: `npm run build && DEMO_MODE=true npm start`. */
export const BASE = process.env.BASE ?? 'http://localhost:5181'

/** Uses the Chrome that is installed; set CHROME_PATH to point at a specific browser binary instead. */
export const launch = () =>
  chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' })

export const ROUTES = ['dashboard', 'expenses', 'income', 'categories', 'budgets', 'recurring', 'goals', 'debts', 'reports', 'settings', 'help']

/** Waits until the page has stopped loading data. */
export async function ready(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => !document.body.innerText.includes('Loading…'), null, { timeout: 15000 }).catch(() => {})
}
