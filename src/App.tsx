import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthContext.ts'
import { AppLayout } from './components/layout/AppLayout.tsx'
import type { NavId } from './config/navigation.ts'
import { useRoute } from './lib/route.ts'
import { AuthPage, AuthStatus } from './pages/Auth.tsx'
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

function Pages() {
  const active = useRoute()

  return <AppLayout active={active}>{pages[active]}</AppLayout>
}

function App() {
  const { status, user, anonymous } = useAuth()

  if (status !== 'ready') return <AuthStatus />
  // Nothing of the app is mounted until there is someone to show it to: no page asks the server for
  // data it would refuse, and signing out throws away everything the last person had on screen.
  if (!user && !anonymous) return <AuthPage />
  return <Pages />
}

export default App
