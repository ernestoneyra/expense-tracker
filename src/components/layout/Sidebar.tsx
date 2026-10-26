import { navItems, type NavId } from '../../config/navigation.ts'
import { Icon } from '../ui/Icon.tsx'

interface SidebarProps {
  open: boolean
  active: NavId
  onSelect: (id: NavId) => void
}

export function Sidebar({ open, active, onSelect }: SidebarProps) {
  return (
    <aside
      id="app-sidebar"
      className={`sticky top-(--header-h) h-[calc(100svh-var(--header-h))] self-start overflow-y-auto border-r border-line bg-surface px-3 py-4 max-nav:fixed max-nav:bottom-0 max-nav:left-0 max-nav:z-20 max-nav:h-auto max-nav:w-[min(280px,82vw)] max-nav:transition-[transform,visibility] max-nav:duration-200 motion-reduce:transition-none ${
        open
          ? 'max-nav:visible max-nav:translate-x-0 max-nav:shadow-(--shadow)'
          : 'max-nav:invisible max-nav:-translate-x-full'
      }`}
    >
      <nav aria-label="Main">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left font-medium text-body transition-colors hover:bg-hover hover:text-strong aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text"
                aria-current={item.id === active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
