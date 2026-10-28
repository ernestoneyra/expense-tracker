// Checks the colour tokens in src/index.css against WCAG AAA (1.4.6): 7:1 for text on every background it
// can appear on, and 3:1 for the edge of a field, the focus ring and the progress bar (1.4.11).
// Reading the values from the stylesheet keeps one source of truth: change a token there and run this.
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

/** `--name: light-dark(a, b)` → { name: [a, b] }. The values can themselves contain commas (rgba). */
function readTokens() {
  const tokens = {}
  for (const match of css.matchAll(/--([\w-]+):\s*light-dark\(/g)) {
    let depth = 1
    let i = match.index + match[0].length
    const start = i
    let comma = -1
    for (; depth > 0; i++) {
      if (css[i] === '(') depth++
      else if (css[i] === ')') depth--
      else if (css[i] === ',' && depth === 1 && comma < 0) comma = i
    }
    tokens[match[1]] = [css.slice(start, comma).trim(), css.slice(comma + 1, i - 1).trim()]
  }
  return tokens
}

const parse = (value) => {
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(value)
  if (rgba) return { rgb: rgba.slice(1, 4).map(Number), alpha: Number(rgba[4]) }
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (!hex) throw new Error(`Unsupported colour: ${value}`)
  return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), alpha: 1 }
}
const over = (fg, bg) => fg.rgb.map((c, i) => Math.round(c * fg.alpha + bg[i] * (1 - fg.alpha)))
const linear = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const tokens = readTokens()
let failures = 0
for (const [index, mode] of ['light', 'dark'].entries()) {
  // Parsed on demand: not every token is a colour (--shadow is not).
  const color = (name) => parse(tokens[name][index])
  const solid = (name) => color(name).rgb
  const surfaces = {
    page: solid('bg'),
    card: solid('surface'),
    hover: solid('hover'),
    'selected on card': over(color('accent-bg'), solid('surface')),
    'selected on page': over(color('accent-bg'), solid('bg')),
  }
  const check = (label, fg, bg, min) => {
    const r = ratio(fg, bg)
    if (r < min) {
      failures++
      console.log(`FAIL ${mode}: ${label} is ${r.toFixed(2)}:1, needs ${min}:1`)
    }
  }
  for (const [surface, bg] of Object.entries(surfaces)) {
    for (const text of ['text', 'text-strong', 'text-muted', 'accent-text']) check(`${text} on ${surface}`, solid(text), bg, 7)
    if (!surface.startsWith('selected')) check(`danger on ${surface}`, solid('danger'), bg, 7)
    for (const ui of ['field', 'focus']) if (!surface.startsWith('selected')) check(`${ui} on ${surface}`, solid(ui), bg, 3)
  }
  check('button text on accent', solid('accent-contrast'), solid('accent'), 7)
  check('button text on danger', solid('danger-contrast'), solid('danger'), 7)
  check('progress fill on track', solid('accent'), solid('track'), 3)
  check('progress fill on card', solid('accent'), solid('surface'), 3)
}
console.log(failures ? `${failures} colour pairs below AAA` : `Colour tokens meet AAA contrast in light and dark (${Object.keys(tokens).length} tokens read).`)
if (failures) process.exitCode = 1
