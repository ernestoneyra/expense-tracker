import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'

export function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={title} subtitle="This section is coming soon." />
      <Card className="px-5 py-12 text-center text-muted">Nothing here yet.</Card>
    </div>
  )
}
