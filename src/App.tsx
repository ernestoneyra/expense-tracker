import type { ReactNode } from 'react'
import { AppLayout } from './components/layout/AppLayout.tsx'
import type { NavId } from './config/navigation.ts'
import { useRoute } from './lib/route.ts'
import { Budgets } from './pages/Budgets.tsx'
import { Categories } from './pages/Categories.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Debts } from './pages/Debts.tsx'
import { Expenses } from './pages/Expenses.tsx'
import { Goals } from './pages/Goals.tsx'
import { Help } from './pages/Help.tsx'
import { Income } from './pages/Income.tsx'
import { Recurring } from './pages/Recurring.tsx'
import { Reports } from './pages/Reports.tsx'
import { Settings } from './pages/Settings.tsx'

const pages: Record<NavId, ReactNode> = {
  dashboard: <Dashboard />,
  expenses: <Expenses />,
  income: <Income />,
  categories: <Categories />,
  budgets: <Budgets />,
  recurring: <Recurring />,
  goals: <Goals />,
  debts: <Debts />,
  reports: <Reports />,
  settings: <Settings />,
  help: <Help />,
}

function App() {
  const active = useRoute()

  return <AppLayout active={active}>{pages[active]}</AppLayout>
}

export default App
