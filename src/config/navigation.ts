import type { IconName } from '../components/ui/Icon.tsx'
import type { MessageKey } from '../i18n/config.ts'

export type NavId =
  | 'dashboard'
  | 'expenses'
  | 'categories'
  | 'budgets'
  | 'reports'
  | 'recurring'
  | 'settings'

export interface NavItem {
  id: NavId
  labelKey: MessageKey
  icon: IconName
}

export const navItems: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { id: 'expenses', labelKey: 'nav.expenses', icon: 'expenses' },
  { id: 'categories', labelKey: 'nav.categories', icon: 'categories' },
  { id: 'budgets', labelKey: 'nav.budgets', icon: 'budgets' },
  { id: 'reports', labelKey: 'nav.reports', icon: 'reports' },
  { id: 'recurring', labelKey: 'nav.recurring', icon: 'recurring' },
  { id: 'settings', labelKey: 'nav.settings', icon: 'settings' },
]
