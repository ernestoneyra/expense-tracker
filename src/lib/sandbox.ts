const STORAGE_KEY = 'expenser.sandbox'

// getRandomValues also works on plain-http pages, where crypto.randomUUID does not exist.
function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let current: string | undefined

/**
 * This browser's sandbox id. The server keeps a private copy of the demo data per id, so
 * visitors never see each other's expenses. Kept in localStorage; if that is blocked the id
 * only lasts until the page is reloaded.
 */
export function getSandboxId() {
  if (current) return current
  try {
    current = localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    // Storage unavailable (private mode, blocked cookies): fall through to a temporary id.
  }
  if (!current) {
    current = newId()
    try {
      localStorage.setItem(STORAGE_KEY, current)
    } catch {
      // Same as above.
    }
  }
  return current
}
