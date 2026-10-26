import type { Theme } from '../../hooks/useTheme.ts'
import { Button, IconButton } from '../ui/Button.tsx'
import { Icon } from '../ui/Icon.tsx'

interface HeaderProps {
  menuOpen: boolean
  theme: Theme
  onMenuToggle: () => void
  onThemeToggle: () => void
  onAddExpense: () => void
}

export function Header({
  menuOpen,
  theme,
  onMenuToggle,
  onThemeToggle,
  onAddExpense,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 col-span-full flex items-center gap-3 border-b border-line bg-surface px-4 nav:px-5">
      <IconButton
        className="-ml-2 nav:hidden"
        onClick={onMenuToggle}
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
      >
        <Icon name={menuOpen ? 'close' : 'menu'} />
      </IconButton>

      <a
        className="flex items-center gap-2.5 text-strong no-underline"
        href="/"
        aria-label="Expenser home"
      >
        <span
          className="grid size-8 place-items-center rounded-[9px] bg-accent text-[17px] font-bold text-accent-contrast"
          aria-hidden="true"
        >
          E
        </span>
        <span className="text-xl font-bold tracking-tight">Expenser</span>
      </a>

      <div className="ml-auto flex items-center gap-2">
        <Button onClick={onAddExpense}>
          <Icon name="plus" size={18} />
          <span className="max-nav:hidden">Add expense</span>
        </Button>
        <IconButton
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </IconButton>
        <IconButton className="rounded-full border border-line" aria-label="Account">
          <Icon name="user" />
        </IconButton>
      </div>
    </header>
  )
}
