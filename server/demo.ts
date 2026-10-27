import type { Currency } from './rates.ts'

export const DEFAULT_CATEGORIES = [
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
]

export const DEMO_BUDGET = { monthlyCents: 200_000, currency: 'USD' as Currency }

interface DemoExpense {
  title: string
  category: string
  description?: string
  /** 0 = this month, 1 = last month. */
  monthsAgo: 0 | 1
  day: number
  currency: Currency
  amountCents: number
}

// A mix of currencies so the exchange-rate conversion is visible on the dashboard.
const DEMO_EXPENSES: DemoExpense[] = [
  { title: 'Monthly rent', category: 'Housing', monthsAgo: 0, day: 1, currency: 'USD', amountCents: 125_000 },
  { title: 'Whole Foods', category: 'Groceries', description: 'Weekly groceries', monthsAgo: 0, day: 3, currency: 'USD', amountCents: 8_640 },
  { title: 'Electric bill', category: 'Utilities', monthsAgo: 0, day: 4, currency: 'USD', amountCents: 7_415 },
  { title: 'Netflix', category: 'Subscriptions', monthsAgo: 0, day: 5, currency: 'USD', amountCents: 1_549 },
  { title: 'Ramen Nagi', category: 'Dining', description: 'Lunch in Tokyo', monthsAgo: 0, day: 7, currency: 'JPY', amountCents: 180_000 },
  { title: 'Weekly transit pass', category: 'Transport', monthsAgo: 0, day: 8, currency: 'EUR', amountCents: 3_200 },
  { title: 'ICA Maxi', category: 'Groceries', monthsAgo: 0, day: 10, currency: 'SEK', amountCents: 64_250 },
  { title: 'Pharmacy', category: 'Healthcare', monthsAgo: 0, day: 12, currency: 'USD', amountCents: 2_380 },
  { title: 'Concert tickets', category: 'Entertainment', description: 'Two tickets', monthsAgo: 0, day: 14, currency: 'GBP', amountCents: 6_500 },
  { title: 'Running shoes', category: 'Shopping', monthsAgo: 0, day: 16, currency: 'USD', amountCents: 11_999 },
  { title: 'Dinner with friends', category: 'Dining', monthsAgo: 0, day: 18, currency: 'USD', amountCents: 5_820 },
  { title: 'Spotify', category: 'Subscriptions', monthsAgo: 0, day: 20, currency: 'USD', amountCents: 1_099 },
  { title: 'Taxi', category: 'Transport', monthsAgo: 0, day: 22, currency: 'TWD', amountCents: 32_000 },
  { title: 'Coffee beans', category: 'Groceries', monthsAgo: 0, day: 24, currency: 'EUR', amountCents: 1_450 },

  { title: 'Monthly rent', category: 'Housing', monthsAgo: 1, day: 1, currency: 'USD', amountCents: 125_000 },
  { title: 'Whole Foods', category: 'Groceries', monthsAgo: 1, day: 4, currency: 'USD', amountCents: 9_210 },
  { title: 'Electric bill', category: 'Utilities', monthsAgo: 1, day: 5, currency: 'USD', amountCents: 6_980 },
  { title: 'Netflix', category: 'Subscriptions', monthsAgo: 1, day: 5, currency: 'USD', amountCents: 1_549 },
  { title: 'Sushi lunch', category: 'Dining', monthsAgo: 1, day: 9, currency: 'JPY', amountCents: 240_000 },
  { title: 'Train tickets', category: 'Transport', monthsAgo: 1, day: 11, currency: 'EUR', amountCents: 4_800 },
  { title: 'ICA Maxi', category: 'Groceries', monthsAgo: 1, day: 13, currency: 'SEK', amountCents: 71_000 },
  { title: 'Cinema', category: 'Entertainment', monthsAgo: 1, day: 15, currency: 'USD', amountCents: 2_800 },
  { title: 'Winter jacket', category: 'Shopping', monthsAgo: 1, day: 19, currency: 'USD', amountCents: 14_000 },
  { title: 'Spotify', category: 'Subscriptions', monthsAgo: 1, day: 20, currency: 'USD', amountCents: 1_099 },
  { title: 'Dentist', category: 'Healthcare', monthsAgo: 1, day: 23, currency: 'USD', amountCents: 8_500 },
  { title: 'Brunch', category: 'Dining', monthsAgo: 1, day: 26, currency: 'USD', amountCents: 4_130 },
]

/** The demo expenses dated relative to `now`, so the dashboard always has this and last month to compare. */
export function demoExpenses(now: Date) {
  return DEMO_EXPENSES.map(({ monthsAgo, day, ...expense }) => ({
    ...expense,
    // This month's dates stop at today so nothing sits in the future.
    date: new Date(
      Date.UTC(now.getFullYear(), now.getMonth() - monthsAgo, monthsAgo === 0 ? Math.min(day, now.getDate()) : day),
    ),
  }))
}
