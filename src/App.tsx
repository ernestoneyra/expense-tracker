import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout.tsx'
import { navItems, type NavId } from './config/navigation.ts'
import { usePreferences } from './i18n/PreferencesContext.ts'
import { Categories } from './pages/Categories.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Expenses } from './pages/Expenses.tsx'
import { Placeholder } from './pages/Placeholder.tsx'
import { Settings } from './pages/Settings.tsx'

function App() {
  const [active, setActive] = useState<NavId>('dashboard')
  const { t } = usePreferences()
  const current = navItems.find((item) => item.id === active)!

  return (
    <AppLayout active={active} onNavigate={setActive}>
      {active === 'dashboard' ? (
        <Dashboard />
      ) : active === 'expenses' ? (
        <Expenses />
      ) : active === 'categories' ? (
        <Categories />
      ) : active === 'settings' ? (
        <Settings />
      ) : (
        <Placeholder title={t(current.labelKey)} />
      )}
    </AppLayout>
  )
}

export default App
