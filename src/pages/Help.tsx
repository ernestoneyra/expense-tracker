import { Card } from '../components/ui/Card.tsx'
import { cardTitleClass } from '../components/ui/fields.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import type { MessageKey } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'

// A glossary for the specialist words in the app (3.1.3, 3.1.4), in plain language (3.1.5).
// Each term has `glossary.<term>.term` and `glossary.<term>.def` messages.
const GROUPS = [
  {
    id: 'budget',
    title: 'help.groupBudget',
    terms: ['budget', 'envelope', 'split', 'zeroBased', 'payFirst', 'savingsRate', 'fixedVariable'],
  },
  { id: 'saving', title: 'help.groupSaving', terms: ['sinkingFund', 'emergencyFund'] },
  { id: 'debt', title: 'help.groupDebt', terms: ['apr', 'minimumPayment', 'avalanche', 'snowball'] },
  { id: 'data', title: 'help.groupData', terms: ['recurring', 'exchangeRate', 'csv', 'json'] },
] as const satisfies readonly { id: string; title: MessageKey; terms: readonly string[] }[]

const KEYBOARD_TIPS = ['help.a11y1', 'help.a11y2', 'help.a11y3', 'help.a11y4'] as const

export function Help() {
  const { t } = usePreferences()
  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('help.title')} subtitle={t('help.subtitle')} />

      {GROUPS.map((group) => (
        <Card key={group.id} className="px-5 pt-2 pb-4" aria-labelledby={`help-${group.id}`}>
          <h2 id={`help-${group.id}`} className={`pt-3.5 pb-2 ${cardTitleClass}`}>
            {t(group.title)}
          </h2>
          <dl className="m-0">
            {group.terms.map((term) => (
              <div key={term} className="border-t border-line py-3">
                <dt className="font-semibold text-strong">{t(`glossary.${term}.term` as const)}</dt>
                <dd className="measure m-0 text-body">{t(`glossary.${term}.def` as const)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}

      <Card className="px-5 pt-2 pb-4" aria-labelledby="help-keyboard">
        <h2 id="help-keyboard" className={`pt-3.5 pb-2 ${cardTitleClass}`}>
          {t('help.a11yTitle')}
        </h2>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          {KEYBOARD_TIPS.map((key) => (
            <li key={key} className="measure text-body">
              {t(key)}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
