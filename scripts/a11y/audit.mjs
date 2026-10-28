// Runs axe-core (WCAG 2.0 / 2.1 / 2.2 rules at A, AA and AAA, plus best practice) on every page in light and dark
// and at phone width, and adds the checks axe does not make: 44 px targets, 14 px text, line spacing, reflow.
import { BASE, ROUTES, launch, ready } from './browser.mjs'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const browser = await launch()
const problems = []
const note = (where, kind, detail) => problems.push({ where, kind, detail })

async function customChecks(page, where) {
  const found = await page.evaluate(() => {
    const out = { small: [], tiny: [], tight: [], overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
    const visible = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const label = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`
    for (const el of document.querySelectorAll('a[href], button, select, textarea, input:not([type=hidden]), summary')) {
      if (!visible(el) || el.closest('.sr-only')) continue
      if (el.matches('a.fixed') && !el.matches(':focus')) continue // skip link, off screen until focused
      const r = el.getBoundingClientRect()
      if (r.width < 43.5 || r.height < 43.5) out.small.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('.sr-only')) continue
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (!own) continue
      const cs = getComputedStyle(el)
      const size = parseFloat(cs.fontSize)
      if (size < 14) out.tiny.push(`${label(el)} ${size}px`)
      if (['P', 'DD', 'LI'].includes(el.tagName)) {
        const lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight)
        if (lh < size * 1.5 - 0.01) out.tight.push(`${label(el)} line-height ${lh}/${size}`)
      }
    }
    return out
  })
  if (found.small.length) note(where, 'target<44px', [...new Set(found.small)].slice(0, 8))
  if (found.tiny.length) note(where, 'text<14px', [...new Set(found.tiny)].slice(0, 5))
  if (found.tight.length) note(where, 'line-height<1.5', [...new Set(found.tight)].slice(0, 5))
  if (found.overflow > 0) note(where, 'horizontal-overflow', `${found.overflow}px`)
}

async function axeRun(page, where) {
  await page.evaluate(axeSource)
  const result = await page.evaluate(async (tags) => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete'] })
    const pick = (v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => ({ t: n.target.join(' '), m: (n.any[0] || n.all[0] || n.none[0] || {}).message })), count: v.nodes.length })
    return { violations: r.violations.map(pick), incomplete: r.incomplete.map(pick) }
  }, TAGS)
  for (const v of result.violations) note(where, `axe:${v.id} (${v.impact}) x${v.count}`, v.nodes.map((n) => `${n.t} -> ${n.m}`))
  for (const v of result.incomplete) note(where, `axe-review:${v.id} x${v.count}`, v.nodes.slice(0, 2).map((n) => `${n.t} -> ${n.m}`))
}

for (const [scheme, viewport] of [
  ['light', { width: 1280, height: 900 }],
  ['dark', { width: 1280, height: 900 }],
  ['light', { width: 375, height: 800 }],
]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, locale: 'en-US' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  for (const route of ROUTES) {
    const where = `${route} [${scheme} ${viewport.width}px]`
    await page.goto(`${BASE}/#/${route}`)
    await ready(page)
    await axeRun(page, where)
    await customChecks(page, where)
  }
  if (errors.length) note(`console [${scheme} ${viewport.width}px]`, 'console-errors', [...new Set(errors)].slice(0, 5))
  await ctx.close()
}
await browser.close()

const grouped = new Map()
for (const p of problems) {
  const key = `${p.kind} :: ${JSON.stringify(p.detail)}`
  if (!grouped.has(key)) grouped.set(key, { kind: p.kind, detail: p.detail, where: [] })
  grouped.get(key).where.push(p.where)
}
for (const g of grouped.values()) {
  console.log(`\n● ${g.kind}  (${g.where.length} page-views: ${g.where.slice(0, 4).join(', ')}${g.where.length > 4 ? ', …' : ''})`)
  for (const d of [].concat(g.detail)) console.log('    ' + d)
}
const failing = [...grouped.values()].filter((g) => !g.kind.startsWith('axe-review'))
console.log(`\n${failing.length} failing findings (and ${grouped.size - failing.length} for manual review) across ${ROUTES.length * 3} page-views`)
if (failing.length) process.exitCode = 1
