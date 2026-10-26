import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'

// Placeholder values until the MongoDB-backed API exists.
const stats = [
  { label: 'Spent this month', value: '$1,284.50', hint: '+8% vs last month' },
  { label: 'Budget left', value: '$715.50', hint: 'of $2,000.00' },
  { label: 'Top category', value: 'Groceries', hint: '$412.30' },
  { label: 'Transactions', value: '37', hint: 'this month' },
]

const recent = [
  { id: 1, title: 'Whole Foods', category: 'Groceries', date: 'Oct 25', amount: '$64.20' },
  { id: 2, title: 'Metro card', category: 'Transport', date: 'Oct 24', amount: '$30.00' },
  { id: 3, title: 'Netflix', category: 'Subscriptions', date: 'Oct 23', amount: '$15.49' },
  { id: 4, title: 'Dinner with friends', category: 'Dining', date: 'Oct 21', amount: '$48.75' },
  { id: 5, title: 'Electric bill', category: 'Utilities', date: 'Oct 20', amount: '$92.10' },
]

export function Dashboard() {
  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle="A quick look at where your money is going. Showing sample data."
      />

      <section
        className="grid grid-cols-2 gap-3 nav:grid-cols-4 nav:gap-4"
        aria-label="Summary"
      >
        {stats.map((s) => (
          <Card key={s.label} className="flex flex-col gap-1 p-3.5 min-[420px]:p-4.5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="text-xl font-bold tracking-tight text-strong min-[420px]:text-2xl">
              {s.value}
            </p>
            <p className="text-[13px] text-muted">{s.hint}</p>
          </Card>
        ))}
      </section>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="recent-title">
        <h2 id="recent-title" className="pt-3.5 pb-2 text-[17px] font-semibold text-strong">
          Recent expenses
        </h2>
        <ul className="m-0 list-none p-0">
          {recent.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-4 border-t border-line py-3.5"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-strong">{e.title}</span>
                <span className="text-[13px] text-muted">
                  {e.category} · {e.date}
                </span>
              </div>
              <span className="shrink-0 font-semibold text-strong tabular-nums">{e.amount}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
