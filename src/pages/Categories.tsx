import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { ConfirmToast } from '../components/ui/ConfirmToast.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import type { MessageKey } from '../i18n/config.ts'
import { usePreferences } from '../i18n/PreferencesContext.ts'
import { api, useApi, type Category } from '../lib/api.ts'

type SortKey = 'name' | 'frequency'

// `byName` compares the displayed (translated) names, so the order follows the active language.
const sorters: Record<
  SortKey,
  (byName: (a: Category, b: Category) => number) => (a: Category, b: Category) => number
> = {
  name: (byName) => byName,
  // Most-used first; ties fall back to alphabetical so the order is stable.
  frequency: (byName) => (a, b) => b.count - a.count || byName(a, b),
}

const sortOptions: { key: SortKey; labelKey: MessageKey }[] = [
  { key: 'name', labelKey: 'categories.sortName' },
  { key: 'frequency', labelKey: 'categories.sortFrequency' },
]

export function Categories() {
  const { t, locale, categoryName } = usePreferences()
  const { data: categories, error, loading, reload } = useApi<Category[]>('/categories')
  const [name, setName] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<Category>()

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api('/categories', { method: 'POST', body: JSON.stringify({ name }) })
      setName('')
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (c: Category) => {
    setPendingDelete(undefined)
    try {
      await api(`/categories/${c.id}`, { method: 'DELETE' })
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const byName = (a: Category, b: Category) =>
    categoryName(a.name).localeCompare(categoryName(b.name), locale)
  const sorted = categories && [...categories].sort(sorters[sort](byName))

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title={t('categories.title')} subtitle={t('categories.subtitle')} />

      <Card className="p-4 nav:p-5" aria-labelledby="add-category-title">
        <h2 id="add-category-title" className="pb-3 text-[17px] font-semibold text-strong">
          {t('categories.new')}
        </h2>
        <form onSubmit={add} className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
            {t('categories.name')}
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('categories.namePlaceholder')}
              className="min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong placeholder:text-muted"
            />
          </label>
          <Button type="submit" disabled={submitting}>
            <Icon name="plus" size={18} />
            {t('categories.add')}
          </Button>
        </form>
        {formError && (
          <p className="pt-3 text-sm text-red-500" role="alert">
            {formError}
          </p>
        )}
      </Card>

      <Card className="px-5 pt-2 pb-3" aria-labelledby="all-categories-title">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 pb-2">
          <h2 id="all-categories-title" className="text-[17px] font-semibold text-strong">
            {t('categories.all')}
          </h2>
          <div role="group" aria-label={t('categories.sortLabel')} className="flex gap-1">
            {sortOptions.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={sort === o.key}
                onClick={() => setSort(o.key)}
                className={`min-h-9 cursor-pointer rounded-[10px] px-3 text-sm font-medium ${
                  sort === o.key
                    ? 'bg-accent-soft text-accent-text'
                    : 'text-body hover:bg-hover hover:text-strong'
                }`}
              >
                {t(o.labelKey)}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="border-t border-line py-6 text-center text-muted">{t('common.loading')}</p>
        ) : error || !sorted ? (
          <p className="border-t border-line py-6 text-center text-muted" role="alert">
            {t('categories.loadError', { error: error ?? '' })}
          </p>
        ) : sorted.length === 0 ? (
          <p className="border-t border-line py-6 text-center text-muted">{t('categories.empty')}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sorted.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-t border-line py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-strong">{categoryName(c.name)}</span>
                  <span className="text-[13px] text-muted">
                    {t('categories.expenses', { count: c.count })}
                  </span>
                </div>
                <IconButton onClick={() => setPendingDelete(c)} aria-label={t('categories.deleteLabel', { name: categoryName(c.name) })}>
                  <Icon name="close" size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendingDelete && (
        <ConfirmToast
          title={t('categories.confirmTitle', { name: categoryName(pendingDelete.name) })}
          confirmLabel={t('common.delete')}
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(undefined)}
        >
          {pendingDelete.count
            ? t('categories.confirmUsed', { count: pendingDelete.count })
            : t('categories.confirmUnused')}
        </ConfirmToast>
      )}
    </div>
  )
}
