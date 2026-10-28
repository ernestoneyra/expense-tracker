import { useSyncExternalStore } from 'react'

/** What the person chose: a fixed theme, or whatever the system is set to. */
export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'expenser-theme'

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isPreference(saved)) return saved
  } catch {
    // Storage can be unavailable (private mode); fall back to the system setting.
  }
  return 'system'
}

let preference = readPreference()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

function setPreference(next: ThemePreference) {
  preference = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Ignore: the choice just won't persist.
  }
  // Without data-theme the stylesheet follows the system by itself.
  if (next === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = next
  listeners.forEach((listener) => listener())
}

export function useTheme() {
  return { preference: useSyncExternalStore(subscribe, () => preference), setPreference }
}
