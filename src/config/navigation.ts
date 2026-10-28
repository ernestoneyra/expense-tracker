import type { IconName } from '../components/ui/Icon.tsx'
import type { MessageKey } from '../i18n/config.ts'

export type NavId =
  | 'dashboard'
  | 'expenses'
  | 'income'
  | 'categories'
  | 'budgets'
  | 'recurring'
  | 'goals'
  | 'debts'
  | 'reports'
  | 'settings'
  | 'help'

export interface NavItem {
  id: NavId
  labelKey: MessageKey
  icon: IconName
}

export const navItems: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { id: 'expenses', labelKey: 'nav.expenses', icon: 'expenses' },
  { id: 'income', labelKey: 'nav.income', icon: 'income' },
  { id: 'categories', labelKey: 'nav.categories', icon: 'categories' },
  { id: 'budgets', labelKey: 'nav.budgets', icon: 'budgets' },
  { id: 'recurring', labelKey: 'nav.recurring', icon: 'recurring' },
  { id: 'goals', labelKey: 'nav.goals', icon: 'goals' },
  { id: 'debts', labelKey: 'nav.debts', icon: 'debts' },
  { id: 'reports', labelKey: 'nav.reports', icon: 'reports' },
  { id: 'settings', labelKey: 'nav.settings', icon: 'settings' },
  { id: 'help', labelKey: 'nav.help', icon: 'help' },
]
