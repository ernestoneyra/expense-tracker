import { useEffect, useRef, useState, type ReactNode } from 'react'
import { navItems, type NavId } from '../../config/navigation.ts'
import { usePreferences } from '../../i18n/PreferencesContext.ts'
import { SAVED_EVENT } from '../../lib/api.ts'
import { navigate } from '../../lib/route.ts'
import { Header } from './Header.tsx'
import { Sidebar } from './Sidebar.tsx'

interface AppLayoutProps {
  active: NavId
  children: ReactNode
}

export function AppLayout({ active, children }: AppLayoutProps) {
  const { t } = usePreferences()
  // Only meaningful below the desktop breakpoint, where the sidebar is a drawer.
  const [menuOpen, setMenuOpen] = useState(false)
  const main = useRef<HTMLElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const announced = useRef(0)

  const pageTitle = t(navItems.find((item) => item.id === active)!.labelKey)

  // 2.4.2, 2.4.8: the tab title says which page this is.
  useEffect(() => {
    document.title = `${pageTitle} – Expenser`
  }, [pageTitle])

  // 2.4.3: after moving to another page, keyboard and screen reader focus start at its content,
  // not back in the menu. (Not on first load: the browser starts at the top, which is right.)
  const firstPage = useRef(true)
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false
      return
    }
    main.current?.focus()
  }, [active])

  // 4.1.3: say when something was saved or deleted, without moving focus. If the button that was
  // used has gone, focus would be lost to the top of the page, so it goes to the content instead.
  useEffect(() => {
    const onSaved = (e: Event) => {
      const deleted = (e as CustomEvent<{ method: string }>).detail.method === 'DELETE'
      // The same words twice in a row would not be announced again, so alternate an invisible mark.
      announced.current += 1
      setAnnouncement(t(deleted ? 'status.deleted' : 'status.saved') + (announced.current % 2 ? '' : '​'))
      window.setTimeout(() => {
        const focused = document.activeElement
        if (!focused || focused === document.body || !document.contains(focused)) main.current?.focus()
      }, 400)
    }
    window.addEventListener(SAVED_EVENT, onSaved)
    return () => window.removeEventListener(SAVED_EVENT, onSaved)
  }, [t])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        // The drawer is about to become invisible, so keyboard focus goes back to the button that opened it.
        document.getElementById('menu-toggle')?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <div className="grid min-h-svh grid-cols-1 grid-rows-[var(--header-h)_1fr] nav:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      {/* 2.4.1: the first stop for the keyboard jumps past the header and menu. */}
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
        className="fixed top-2 left-2 z-50 -translate-y-24 rounded-[10px] bg-accent px-4 py-3 font-semibold text-accent-contrast focus:translate-y-0"
      >
        {t('a11y.skip')}
      </a>
      <Header
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onAddExpense={() => {
          navigate('expenses')
          setMenuOpen(false)
        }}
      />
      <Sidebar open={menuOpen} active={active} onSelect={() => setMenuOpen(false)} />
      {menuOpen && (
        <div
          className="fixed inset-x-0 top-(--header-h) bottom-0 z-10 bg-black/40 nav:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <main
        ref={main}
        id="main-content"
        tabIndex={-1}
        aria-label={pageTitle}
        className="min-w-0 px-4 pt-5 pb-10 nav:px-8 nav:pt-7 nav:pb-12"
      >
        {children}
      </main>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
