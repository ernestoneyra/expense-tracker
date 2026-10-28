import { usePreferences } from '../../i18n/PreferencesContext.ts'

interface PageHeaderProps {
  title: string
  subtitle: string
  /** Show a link to the glossary, for pages that use words like "APR" or "sinking fund" (3.1.3). */
  glossary?: boolean
}

export function PageHeader({ title, subtitle, glossary = false }: PageHeaderProps) {
  const { t } = usePreferences()
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl leading-tight font-semibold tracking-tight text-strong nav:text-[28px]">
        {title}
      </h1>
      <p className="text-muted">{subtitle}</p>
      {glossary && (
        <a
          href="#/help"
          className="inline-flex min-h-11 items-center self-start font-semibold text-accent-text underline underline-offset-2"
        >
          {t('help.link')}
        </a>
      )}
    </header>
  )
}
