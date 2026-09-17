import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuthStore } from '@/store/authStore'
import type { LocalProduct, LocalCategory } from '@/types/local'

/**
 * Returns active products from local IndexedDB.
 * Reactive — updates automatically when Dexie data changes.
 * Fully offline: reads only from local storage.
 */
export function useProducts(categoryId?: string | null) {
  const business = useAuthStore(s => s.business)

  const products = useLiveQuery(async (): Promise<LocalProduct[]> => {
    if (!business) return []
    const all = await db.products.where('business_id').equals(business.id).toArray()
    const active = all.filter(p => p.active)
    if (categoryId) return active.filter(p => p.category_id === categoryId)
    return active
  }, [business?.id, categoryId]) ?? []

  const categories = useLiveQuery(async (): Promise<LocalCategory[]> => {
    if (!business) return []
    const all = await db.categories.where('business_id').equals(business.id).toArray()
    return all.filter(c => c.active).sort((a, b) => a.sort_order - b.sort_order)
  }, [business?.id]) ?? []

  return { products, categories }
}

/**
 * Returns only active categories from local IndexedDB.
 */
export function useCategories() {
  const business = useAuthStore(s => s.business)
  return useLiveQuery(async (): Promise<LocalCategory[]> => {
    if (!business) return []
    const all = await db.categories.where('business_id').equals(business.id).toArray()
    return all.filter(c => c.active).sort((a, b) => a.sort_order - b.sort_order)
  }, [business?.id]) ?? []
}
