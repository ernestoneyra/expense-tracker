import { useEffect, useState, type ReactNode } from 'react'
import type { NavId } from '../../config/navigation.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { Header } from './Header.tsx'
import { Sidebar } from './Sidebar.tsx'

interface AppLayoutProps {
  active: NavId
  onNavigate: (id: NavId) => void
  children: ReactNode
}

export function AppLayout({ active, onNavigate, children }: AppLayoutProps) {
  // Only meaningful below the desktop breakpoint, where the sidebar is a drawer.
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const handleSelect = (id: NavId) => {
    onNavigate(id)
    setMenuOpen(false)
  }

  return (
    <div className="grid min-h-svh grid-cols-1 grid-rows-[var(--header-h)_1fr] nav:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      <Header
        menuOpen={menuOpen}
        theme={theme}
        onThemeToggle={toggleTheme}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onAddExpense={() => handleSelect('expenses')}
      />
      <Sidebar open={menuOpen} active={active} onSelect={handleSelect} />
      {menuOpen && (
        <div
          className="fixed inset-x-0 top-(--header-h) bottom-0 z-10 bg-black/40 nav:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <main className="min-w-0 px-4 pt-5 pb-10 nav:px-8 nav:pt-7 nav:pb-12">{children}</main>
    </div>
  )
}
