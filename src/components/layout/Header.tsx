import { usePreferences } from '../../i18n/PreferencesContext.ts'
import { Button, IconButton } from '../ui/Button.tsx'
import { Icon } from '../ui/Icon.tsx'
import { AccountMenu } from './AccountMenu.tsx'

interface HeaderProps {
  menuOpen: boolean
  onMenuToggle: () => void
  onAddExpense: () => void
}

export function Header({ menuOpen, onMenuToggle, onAddExpense }: HeaderProps) {
  const { t } = usePreferences()
  return (
    <header className="sticky top-0 z-30 col-span-full flex items-center gap-3 border-b border-line bg-surface px-4 nav:px-5">
      <IconButton
        id="menu-toggle"
        className="-ml-2 nav:hidden"
        onClick={onMenuToggle}
        aria-label={menuOpen ? t('header.closeNav') : t('header.openNav')}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
      >
        <Icon name={menuOpen ? 'close' : 'menu'} />
      </IconButton>

      <a
        className="flex min-h-11 items-center gap-2.5 text-strong no-underline"
        href="#/dashboard"
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
        {/* The text is hidden on narrow screens, so the name is given explicitly (4.1.2). */}
        <Button onClick={onAddExpense} aria-label={t('header.addExpense')}>
          <Icon name="plus" size={18} />
          <span className="max-nav:hidden">{t('header.addExpense')}</span>
        </Button>
        <AccountMenu />
      </div>
    </header>
  )
}
