import { useState, type FormEvent } from 'react'
import { Button, IconButton } from '../components/ui/Button.tsx'
import { Card } from '../components/ui/Card.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { api, useApi, type Category } from '../lib/api.ts'

type SortKey = 'name' | 'frequency'

const sorters: Record<SortKey, (a: Category, b: Category) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  // Most-used first; ties fall back to alphabetical so the order is stable.
  frequency: (a, b) => b.count - a.count || a.name.localeCompare(b.name),
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'A–Z' },
  { key: 'frequency', label: 'Most used' },
]

export function Categories() {
  const { data: categories, error, loading, reload } = useApi<Category[]>('/categories')
  const [name, setName] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string>()

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
    const used = c.count
      ? `${c.count} existing expense${c.count === 1 ? '' : 's'} will keep this label.`
      : 'No expenses use it.'
    if (!window.confirm(`Delete "${c.name}"? ${used}`)) return
    try {
      await api(`/categories/${c.id}`, { method: 'DELETE' })
      setFormError(undefined)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const sorted = categories && [...categories].sort(sorters[sort])

  return (
    <div className="flex max-w-275 flex-col gap-6">
      <PageHeader title="Categories" subtitle="Organize the labels you sort your spending by." />

      <Card className="p-4 nav:p-5" aria-labelledby="add-category-title">
        <h2 id="add-category-title" className="pb-3 text-[17px] font-semibold text-strong">
          New category
        </h2>
        <form onSubmit={add} className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
            Name
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pets"
              className="min-h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-strong placeholder:text-muted"
            />
          </label>
          <Button type="submit" disabled={submitting}>
            <Icon name="plus" size={18} />
            Add category
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
            All categories
          </h2>
          <div role="group" aria-label="Sort categories" className="flex gap-1">
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
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="border-t border-line py-6 text-center text-muted">Loading…</p>
        ) : error || !sorted ? (
          <p className="border-t border-line py-6 text-center text-muted" role="alert">
            Couldn't load categories: {error}. Is the API server running?
          </p>
        ) : sorted.length === 0 ? (
          <p className="border-t border-line py-6 text-center text-muted">No categories yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sorted.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-t border-line py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-strong">{c.name}</span>
                  <span className="text-[13px] text-muted">
                    {c.count} expense{c.count === 1 ? '' : 's'}
                  </span>
                </div>
                <IconButton onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
                  <Icon name="close" size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
