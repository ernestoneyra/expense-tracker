import { useState, type ReactNode } from 'react'
import { AppLayout } from './components/layout/AppLayout.tsx'
import type { NavId } from './config/navigation.ts'
import { Budgets } from './pages/Budgets.tsx'
import { Categories } from './pages/Categories.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Debts } from './pages/Debts.tsx'
import { Expenses } from './pages/Expenses.tsx'
import { Goals } from './pages/Goals.tsx'
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
}

function App() {
  const [active, setActive] = useState<NavId>('dashboard')

  return (
    <AppLayout active={active} onNavigate={setActive}>
      {pages[active]}
    </AppLayout>
  )
}

export default App
