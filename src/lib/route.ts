import { useSyncExternalStore } from 'react'
import { navItems, type NavId } from '../config/navigation.ts'

// The page lives in the URL hash (#/expenses), so the Back button, bookmarks and "open in new tab"
// work, and the current location is something every user can read and share (2.4.8).

const isNavId = (value: string): value is NavId => navItems.some((item) => item.id === value)

function current(): NavId {
  const id = location.hash.replace(/^#\/?/, '').split('/')[0]
  return isNavId(id) ? id : 'dashboard'
}

const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}

export const useRoute = (): NavId => useSyncExternalStore(subscribe, current)

export const hrefFor = (id: NavId) => `#/${id}`

export const navigate = (id: NavId) => {
  location.hash = hrefFor(id)
}
