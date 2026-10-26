// Shared by the client (dropdown) and the server (validation) so they never drift apart.
export const CATEGORIES = [
  'Housing',
  'Groceries',
  'Dining',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Subscriptions',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
