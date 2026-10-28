export const STRATEGIES = ['avalanche', 'snowball'] as const
export type Strategy = (typeof STRATEGIES)[number]

export interface PlanDebt {
  id: string
  name: string
  balanceCents: number
  aprPercent: number
  minPaymentCents: number
}

/** Stop simulating after this many months; a plan that has not finished by then never will. */
const MAX_MONTHS = 1200

/** A balance below half a cent is paid off; it is only floating-point dust. */
const DUST = 0.5

/**
 * Pays the debts down month by month. Every month the same total goes out: all the minimum
 * payments plus `extraCents`. Whatever a minimum no longer needs (a debt paid off, or a balance
 * smaller than its minimum) rolls onto the first debt still open in the strategy's order:
 * - avalanche: highest interest rate first, which costs the least interest
 * - snowball: smallest balance first, which clears whole debts sooner
 */
export function simulatePayoff(debts: PlanDebt[], extraCents: number, strategy: Strategy) {
  const order = debts
    .filter((d) => d.balanceCents > 0)
    .sort((a, b) =>
      strategy === 'avalanche'
        ? b.aprPercent - a.aprPercent || a.balanceCents - b.balanceCents
        : a.balanceCents - b.balanceCents || b.aprPercent - a.aprPercent,
    )
  const balance = new Map(order.map((d) => [d.id, d.balanceCents]))
  const paidOffInMonth = new Map<string, number>()
  const monthlyTotal = order.reduce((sum, d) => sum + d.minPaymentCents, 0) + extraCents
  let interest = 0
  let months = 0

  while (paidOffInMonth.size < order.length && months < MAX_MONTHS) {
    months++
    for (const d of order) {
      const owed = balance.get(d.id)!
      if (owed <= DUST) continue
      const charge = (owed * d.aprPercent) / 1200
      balance.set(d.id, owed + charge)
      interest += charge
    }

    let pool = monthlyTotal
    for (const d of order) {
      const owed = balance.get(d.id)!
      const pay = Math.min(d.minPaymentCents, owed, pool)
      if (pay > 0) {
        balance.set(d.id, owed - pay)
        pool -= pay
      }
    }
    for (const d of order) {
      const owed = balance.get(d.id)!
      const pay = Math.min(owed, pool)
      if (pay > 0) {
        balance.set(d.id, owed - pay)
        pool -= pay
      }
    }

    for (const d of order) {
      if (!paidOffInMonth.has(d.id) && balance.get(d.id)! <= DUST) paidOffInMonth.set(d.id, months)
    }
  }

  const finished = paidOffInMonth.size === order.length
  return {
    // Months until every debt is gone; null if the payments never get there.
    months: finished ? months : null,
    interestCents: finished ? Math.round(interest) : null,
    // In payoff order. `month` is null for a debt this plan never clears.
    order: order.map((d) => ({ id: d.id, month: paidOffInMonth.get(d.id) ?? null })),
  }
}
