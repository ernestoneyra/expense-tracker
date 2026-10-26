import type { IconName } from '../components/ui/Icon.tsx'

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
  label: string
  icon: IconName
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'expenses', label: 'Expenses', icon: 'expenses' },
  { id: 'categories', label: 'Categories', icon: 'categories' },
  { id: 'budgets', label: 'Budgets', icon: 'budgets' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'recurring', label: 'Recurring', icon: 'recurring' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
