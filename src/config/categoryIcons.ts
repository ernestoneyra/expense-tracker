import type { IconName } from '../components/ui/Icon.tsx'

// Keyed by the stored (English) category name; custom categories fall back to the generic tag.
const categoryIcons: Record<string, IconName> = {
  Housing: 'housing',
  Groceries: 'groceries',
  Dining: 'dining',
  Transport: 'transport',
  Utilities: 'utilities',
  Healthcare: 'healthcare',
  Entertainment: 'entertainment',
  Shopping: 'shopping',
  Subscriptions: 'subscriptions',
  Other: 'other',
}

export const categoryIcon = (name: string): IconName => categoryIcons[name] ?? 'categories'
