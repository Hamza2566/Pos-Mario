import { cn } from '@/lib/utils'
import type { LocalCategory } from '@/types/local'

interface CategoryFilterProps {
  categories: LocalCategory[]
  activeCategory: string | null
  onSelect: (id: string | null) => void
}

export function CategoryFilter({ categories, activeCategory, onSelect }: CategoryFilterProps) {
  const all = [{ id: null, name: 'All', color: null }]
  const items = [...all, ...categories.filter(c => c.active)]

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
      {items.map(cat => {
        const isActive = cat.id === activeCategory
        return (
          <button
            key={String(cat.id)}
            id={`category-${cat.id ?? 'all'}`}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {cat.name}
          </button>
        )
      })}
    </div>
  )
}
