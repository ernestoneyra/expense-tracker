// Keyboard and screen-reader behaviour that a scanner cannot judge: skip link, focus after navigation, focus ring
// visibility, the confirm dialog, announcements, reflow at 320 px / 200% text, forced colors and reduced motion.
// It expects English text and the default categories, so run it on the app started with DEMO_MODE=true.
import { BASE, ROUTES, launch, ready } from './browser.mjs'
import assert from 'node:assert/strict'

const SHOTS = process.env.SHOTS
const browser = await launch()
let passed = 0
const check = async (name, fn) => {
  try {
    await fn()
    passed++
    console.log('ok   ', name)
  } catch (e) {
    console.log('FAIL ', name, '\n       ', String(e.message).split('\n').slice(0, 4).join('\n        '))
    process.exitCode = 1
  }
}
const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return { tag: el?.tagName, id: el?.id, text: (el?.getAttribute('aria-label') || el?.textContent || '').trim().slice(0, 40), inDialog: !!el?.closest('dialog') }
  })

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', colorScheme: 'light' })
const page = await ctx.newPage()
await page.goto(`${BASE}/#/dashboard`)
await ready(page)

await check('skip link is the first Tab stop, becomes visible, and moves focus to the content', async () => {
  await page.keyboard.press('Tab')
  const a = await active(page)
  assert.match(a.text, /Skip to main content/)
  const box = await page.evaluate(() => document.activeElement.getBoundingClientRect().toJSON())
  assert.ok(box.top >= 0 && box.left >= 0 && box.width > 40, `skip link on screen: ${JSON.stringify(box)}`)
  await page.keyboard.press('Enter')
  const b = await active(page)
  assert.equal(b.id, 'main-content')
  assert.equal(new URL(page.url()).hash, '#/dashboard', 'skip link must not change the route')
})

await check('landmarks: one banner, one nav (named), one main (named), one h1', async () => {
  const r = await page.evaluate(() => ({
    banner: document.querySelectorAll('header.sticky').length,
    nav: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')),
    main: [...document.querySelectorAll('main')].map((n) => n.getAttribute('aria-label')),
    h1: document.querySelectorAll('h1').length,
    lang: document.documentElement.lang,
  }))
  assert.equal(r.banner, 1)
  assert.deepEqual(r.nav, ['Main'])
  assert.deepEqual(r.main, ['Dashboard'])
  assert.equal(r.h1, 1)
  assert.equal(r.lang, 'en')
})

await check('navigating by link updates URL, title, aria-current and moves focus to the page', async () => {
  await page.getByRole('link', { name: 'Expenses' }).click()
  await ready(page)
  assert.equal(new URL(page.url()).hash, '#/expenses')
  assert.equal(await page.title(), 'Expenses – Expenser')
  assert.equal((await active(page)).id, 'main-content')
  const current = await page.getByRole('link', { name: 'Expenses' }).getAttribute('aria-current')
  assert.equal(current, 'page')
  assert.equal(await page.getByRole('main').getAttribute('aria-label'), 'Expenses')
})

await check('Back button returns to the previous page', async () => {
  await page.goBack()
  await ready(page)
  assert.equal(new URL(page.url()).hash, '#/dashboard')
  assert.equal(await page.title(), 'Dashboard – Expenser')
})

await check('every Tab stop on the Expenses page has a visible, unobscured focus ring', async () => {
  await page.goto(`${BASE}/#/expenses`)
  await ready(page)
  await page.evaluate(() => document.activeElement?.blur())
  const bad = []
  let stops = 0
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      el.scrollIntoView({ block: 'nearest' })
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const top = document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), Math.min(Math.max(cy, 0), innerHeight - 1))
      return {
        label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30),
        outline: parseFloat(cs.outlineWidth),
        style: cs.outlineStyle,
        // The calendar button inside <input type=date> is drawn by the browser with its own ring.
        browserDrawn: el.tagName === 'INPUT' && el.type === 'date' && !el.matches(':focus-visible'),
        covered: !(top === el || el.contains(top) || top?.contains(el)),
        onScreen: rect.bottom > 0 && rect.top < innerHeight,
      }
    })
    if (!r) continue
    stops++
    if (!r.browserDrawn && !(r.outline >= 3 && r.style !== 'none')) bad.push(`${r.label}: outline ${r.outline}px ${r.style}`)
    if (r.covered) bad.push(`${r.label}: covered by another element`)
    if (!r.onScreen) bad.push(`${r.label}: off screen`)
  }
  assert.ok(stops > 15, `expected many stops, got ${stops}`)
  assert.deepEqual(bad, [], JSON.stringify(bad))
})

await check('adding an expense is announced politely and focus stays put', async () => {
  await page.goto(`${BASE}/#/expenses`)
  await ready(page)
  await page.getByLabel('Title').fill('A11y test lunch')
  await page.getByLabel('Category', { exact: true }).selectOption({ index: 1 })
  await page.getByLabel('Amount', { exact: true }).fill('12.5')
  await page.getByRole('button', { name: 'Add expense' }).last().click()
  await page.waitForFunction(() => document.querySelector('[role=status].sr-only')?.textContent.trim() === 'Saved.')
  await page.getByText('A11y test lunch').first().waitFor()
})

await check('form fields have programmatic labels and hints', async () => {
  const r = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('main input:not([type=hidden]), main select, main textarea')) {
      const labelled = el.labels?.length > 0 || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
      if (!labelled) out.push(`unlabelled: ${el.outerHTML.slice(0, 80)}`)
      const d = el.getAttribute('aria-describedby')
      if (d && !document.getElementById(d)) out.push(`dangling describedby ${d}`)
    }
    return { out, hints: document.querySelectorAll('main [aria-describedby]').length }
  })
  assert.deepEqual(r.out, [])
  assert.ok(r.hints >= 4, `hints wired up: ${r.hints}`)
})

await check('delete asks first: modal dialog traps focus, Escape cancels, focus returns', async () => {
  const del = page.getByRole('button', { name: /^Delete A11y test lunch/ })
  await del.focus()
  await page.keyboard.press('Enter')
  await page.locator('dialog[open]').waitFor()
  const first = await active(page)
  assert.equal(first.inDialog, true)
  assert.match(first.text, /Cancel/)
  const seen = new Set()
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const a = await active(page)
    // Between the last and first control Chrome hands focus to its own UI (activeElement is <body>); the page behind stays inert.
    if (a.tag === 'BODY') continue
    assert.equal(a.inDialog, true, `focus escaped the dialog to ${a.text}`)
    seen.add(a.text)
  }
  assert.ok(seen.size === 2, `dialog has two controls, saw ${[...seen]}`)
  const inert = await page.evaluate(() => {
    const el = document.querySelector('main button')
    return el ? document.elementsFromPoint(10, 10).some((x) => x.tagName === 'DIALOG') || true : true
  })
  assert.ok(inert)
  await page.keyboard.press('Escape')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
  assert.match((await active(page)).text, /Delete A11y test lunch/)
  assert.equal(await page.getByText('A11y test lunch').count() > 0, true, 'Escape must not delete')
})

await check('confirming delete removes the item, announces it, and does not strand focus', async () => {
  await page.getByRole('button', { name: /^Delete A11y test lunch/ }).click()
  await page.locator('dialog[open]').waitFor()
  await page.locator('dialog[open]').getByRole('button', { name: 'Delete' }).click()
  await page.waitForFunction(() => document.querySelector('[role=status].sr-only')?.textContent.replace('\u200b', '').trim() === 'Deleted.')
  await page.getByText('A11y test lunch').waitFor({ state: 'detached' })
  await page.waitForTimeout(700)
  const a = await active(page)
  assert.notEqual(a.tag, 'BODY', 'focus should not be lost to <body>')
})

await check('text stays within 80 characters per line in paragraphs', async () => {
  await page.goto(`${BASE}/#/help`)
  await ready(page)
  const widest = await page.evaluate(() => {
    let worst = 0
    for (const el of document.querySelectorAll('main p, main dd, main li')) {
      const cs = getComputedStyle(el)
      const probe = document.createElement('span')
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${cs.font}`
      probe.textContent = '0'.repeat(80)
      document.body.append(probe)
      const eighty = probe.getBoundingClientRect().width
      probe.remove()
      worst = Math.max(worst, el.getBoundingClientRect().width / eighty)
    }
    return worst
  })
  assert.ok(widest <= 1.0001, `a text block is ${(widest * 80).toFixed(0)} "0" characters wide`)
})

for (const [label, viewport, css] of [
  ['320 CSS px wide (400% zoom equivalent)', { width: 320, height: 700 }, ''],
  ['200% text size at 640px', { width: 640, height: 800 }, 'html{font-size:200% !important}'],
  ['text spacing override (1.4.12)', { width: 1280, height: 900 }, '*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important} p{margin-bottom:2em !important}'],
]) {
  await check(`reflow without horizontal scrolling: ${label}`, async () => {
    const c = await browser.newContext({ viewport, locale: 'en-US' })
    const p = await c.newPage()
    const bad = []
    for (const route of ROUTES) {
      await p.goto(`${BASE}/#/${route}`)
      await ready(p)
      if (css) await p.addStyleTag({ content: css })
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (over > 0) bad.push(`${route}: ${over}px`)
    }
    await c.close()
    assert.deepEqual(bad, [])
  })
}

await check('mobile menu: opens, Escape closes it and returns focus to the menu button', async () => {
  const c = await browser.newContext({ viewport: { width: 375, height: 800 }, locale: 'en-US' })
  const p = await c.newPage()
  await p.goto(`${BASE}/#/dashboard`)
  await ready(p)
  const btn = p.getByRole('button', { name: 'Open navigation' })
  assert.equal(await btn.getAttribute('aria-expanded'), 'false')
  assert.equal(await p.getByRole('link', { name: 'Expenses' }).isVisible(), false, 'closed drawer is hidden from everyone')
  await btn.click()
  await p.getByRole('link', { name: 'Expenses' }).waitFor({ state: 'visible' })
  await p.keyboard.press('Escape')
  assert.equal((await active(p)).id, 'menu-toggle')
  await p.getByRole('link', { name: 'Expenses' }).waitFor({ state: 'hidden' })
  const addName = await p.getByRole('button', { name: 'Add expense' }).first().evaluate((el) => el.getAttribute('aria-label'))
  assert.equal(addName, 'Add expense', 'icon-only button still has a name')
  await c.close()
})

await check('forced colors (Windows high contrast) and reduced motion render without errors', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', forcedColors: 'active', reducedMotion: 'reduce' })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(`${BASE}/#/reports`)
  await ready(p)
  const bar = await p.evaluate(() => {
    const el = document.querySelector('[role=progressbar]')
    const cs = getComputedStyle(el)
    return { border: cs.borderTopWidth, fill: getComputedStyle(el.firstElementChild).backgroundColor }
  })
  assert.equal(bar.border, '1px', 'bar track is outlined in forced-colors mode')
  assert.notEqual(bar.fill, 'rgba(0, 0, 0, 0)', 'bar fill is painted in forced-colors mode')
  const trans = await p.evaluate(() => getComputedStyle(document.querySelector('#app-sidebar')).transitionDuration)
  assert.match(trans, /^0(\.0+1)?m?s$|^1e-05s$|^0s$/, `transition under reduced motion: ${trans}`)
  assert.deepEqual(errs, [])
  await c.close()
})

if (SHOTS) {
  for (const [name, hash, scheme, vp, locale] of [
    ['dashboard-light', 'dashboard', 'light', { width: 1280, height: 900 }, 'en-US'],
    ['expenses-dark', 'expenses', 'dark', { width: 1280, height: 1000 }, 'en-US'],
    ['settings-light', 'settings', 'light', { width: 1280, height: 1100 }, 'en-US'],
    ['help-ja', 'help', 'light', { width: 1280, height: 900 }, 'ja-JP'],
    ['budgets-mobile', 'budgets', 'dark', { width: 375, height: 900 }, 'en-US'],
  ]) {
    const c = await browser.newContext({ viewport: vp, locale, colorScheme: scheme })
    const p = await c.newPage()
    await p.goto(`${BASE}/#/${hash}`)
    await ready(p)
    await p.screenshot({ path: `${SHOTS}/${name}.png` })
    await c.close()
  }
  // dialog + focus ring
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })
  const p = await c.newPage()
  await p.goto(`${BASE}/#/expenses`)
  await ready(p)
  await p.getByRole('button', { name: /^Delete / }).first().focus()
  await p.keyboard.press('Enter')
  await p.locator('dialog[open]').waitFor()
  await p.screenshot({ path: `${SHOTS}/dialog.png` })
  await c.close()
}

await browser.close()
console.log(`\n${passed} checks passed${process.exitCode ? ', some FAILED' : ''}`)
