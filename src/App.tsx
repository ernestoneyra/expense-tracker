import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout.tsx'
import { navItems, type NavId } from './config/navigation.ts'
import { Dashboard } from './pages/Dashboard.tsx'
import { Expenses } from './pages/Expenses.tsx'
import { Placeholder } from './pages/Placeholder.tsx'

function App() {
  const [active, setActive] = useState<NavId>('dashboard')
  const current = navItems.find((item) => item.id === active)!

  return (
    <AppLayout active={active} onNavigate={setActive}>
      {active === 'dashboard' ? (
        <Dashboard />
      ) : active === 'expenses' ? (
        <Expenses />
      ) : (
        <Placeholder title={current.label} />
      )}
    </AppLayout>
  )
}

export default App
