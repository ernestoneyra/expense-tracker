import { Card } from '../components/ui/Card.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { usePreferences } from '../i18n/PreferencesContext.ts'

export function Placeholder({ title }: { title: string }) {
  const { t } = usePreferences()
  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={title} subtitle={t('placeholder.subtitle')} />
      <Card className="px-5 py-12 text-center text-muted">{t('placeholder.empty')}</Card>
    </div>
  )
}
