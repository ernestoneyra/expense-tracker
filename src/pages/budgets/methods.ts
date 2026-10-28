import { api, type BudgetMethod } from '../../lib/api.ts'

/** What every method panel is given. `reload` refetches the overview after a change. */
export interface PanelProps {
  reload: () => void
}

/** Saves which method is active (and its percentages, for the ones that use them). */
export const saveMethod = (body: {
  method: BudgetMethod
  needsPercent?: number
  wantsPercent?: number
  savingsPercent?: number
}) => api('/budget/method', { method: 'PUT', body: JSON.stringify(body) })
