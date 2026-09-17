import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { useSyncStore } from '@/store/syncStore'
import type { LocalSale } from '@/types/local'
import type { CompleteSalePayload } from '@/types'

const MAX_ATTEMPTS = 5

/**
 * Retry delay schedule (exponential backoff in seconds):
 * attempt 1 → 30s, attempt 2 → 2m, attempt 3 → 5m, attempt 4+ → 15m
 */
function getRetryDelay(attempts: number): number {
  const delays = [30_000, 120_000, 300_000, 900_000]
  return delays[Math.min(attempts - 1, delays.length - 1)]
}

/**
 * Synchronize all PENDING or FAILED local sales to Supabase.
 *
 * IDEMPOTENCY: The `complete_sale` Postgres RPC checks if the UUID already
 * exists before inserting. A retry on a previously-synced sale is a safe no-op.
 *
 * ATOMICITY: Each sale is synced independently. Failure of one does not block others.
 */
export async function syncPendingSales(options?: { force?: boolean }): Promise<void> {
  const syncStore = useSyncStore.getState()

  if (!navigator.onLine) {
    syncStore.setStatus('OFFLINE')
    return
  }

  // Find all sales that need syncing
  const pending = await db.sales
    .where('sync_status')
    .anyOf(['PENDING', 'FAILED'])
    .toArray()

  // Filter out sales that are in backoff period
  const now = Date.now()
  const ready = pending.filter((sale) => {
    if (options?.force) return true
    if (sale.sync_status === 'FAILED' && sale.last_sync_attempt) {
      const delay = getRetryDelay(sale.sync_attempts)
      const lastAttempt = new Date(sale.last_sync_attempt).getTime()
      return now - lastAttempt >= delay
    }
    return true
  })

  if (ready.length === 0) {
    const pendingCount = pending.length
    const failedCount = pending.filter((s) => s.sync_status === 'FAILED').length
    syncStore.setPendingCount(pendingCount)
    syncStore.setFailedCount(failedCount)
    syncStore.setStatus(failedCount > 0 ? 'SYNC_ERROR' : pendingCount > 0 ? 'SYNCING' : 'ONLINE')
    return
  }

  syncStore.setStatus('SYNCING')

  for (const sale of ready) {
    await syncSingleSale(sale)
  }

  // Refresh counts
  const remaining = await db.sales.where('sync_status').anyOf(['PENDING', 'FAILED']).count()
  const failedRemaining = await db.sales.where('sync_status').equals('FAILED').count()

  syncStore.setPendingCount(remaining)
  syncStore.setFailedCount(failedRemaining)
  syncStore.setLastSyncAt(new Date().toISOString())

  if (failedRemaining > 0) {
    syncStore.setStatus('SYNC_ERROR')
  } else if (remaining > 0) {
    syncStore.setStatus('SYNCING')
  } else {
    syncStore.setStatus('ONLINE')
  }
}

async function syncSingleSale(sale: LocalSale): Promise<void> {
  // Mark as SYNCING
  await db.sales.update(sale.id, {
    sync_status: 'SYNCING',
    last_sync_attempt: new Date().toISOString(),
  })

  const payload: CompleteSalePayload = {
    p_sale_id: sale.id,
    p_employee_id: sale.employee_id,
    p_business_id: sale.business_id,
    p_device_id: sale.device_id,
    p_items: sale.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      discount_amount: item.discount_amount,
    })),
    p_payment_method: sale.payment_method as never,
    p_payment_reference: sale.payment_reference,
    p_sale_discount: sale.discount_amount,
    p_notes: sale.notes,
  }

  try {
    const { data, error } = await supabase.rpc('complete_sale', payload)

    if (error) throw error

    // Success — mark SYNCED and store the server-assigned sale_number
    await db.sales.update(sale.id, {
      sync_status: 'SYNCED',
      sync_error: null,
      sale_number: (data as { sale_number: string })?.sale_number ?? null,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const newAttempts = sale.sync_attempts + 1

    await db.sales.update(sale.id, {
      sync_status: newAttempts >= MAX_ATTEMPTS ? 'FAILED' : 'FAILED',
      sync_attempts: newAttempts,
      sync_error: errorMessage,
    })

    console.error(`[SyncEngine] Failed to sync sale ${sale.id}:`, errorMessage)
  }
}

/**
 * Sync product catalog from Supabase to local Dexie DB.
 * Called on login and on Realtime product changes.
 */
export async function syncProductsFromCloud(businessId: string): Promise<void> {
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, business_id, category_id, name, price, price_version, active, image_url, updated_at')
    .eq('business_id', businessId)

  if (pError) {
    console.error('[SyncEngine] Failed to sync products:', pError.message)
    return
  }

  const { data: categories, error: cError } = await supabase
    .from('categories')
    .select('id, business_id, name, color, sort_order, active')
    .eq('business_id', businessId)

  if (cError) {
    console.error('[SyncEngine] Failed to sync categories:', cError.message)
    return
  }

  const now = new Date().toISOString()

  if (products) {
    await db.products.bulkPut(
      products.map((p) => ({
        id: p.id,
        business_id: p.business_id,
        category_id: p.category_id,
        name: p.name,
        price: p.price,
        price_version: p.price_version,
        active: p.active,
        image_url: p.image_url,
        last_synced_at: now,
      }))
    )
  }

  if (categories) {
    await db.categories.bulkPut(categories)
  }
}

/**
 * Start the background sync engine.
 * - Listens for online/offline events
 * - Triggers sync on reconnect
 * - Periodic retry for failed sales
 */
let syncInterval: ReturnType<typeof setInterval> | null = null

export function startSyncEngine(businessId: string): () => void {
  const syncStore = useSyncStore.getState()

  const handleOnline = () => {
    syncStore.setStatus('ONLINE')
    syncPendingSales()
    syncProductsFromCloud(businessId)
  }

  const handleOffline = () => {
    syncStore.setStatus('OFFLINE')
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('focus', handleOnline)

  syncInterval = setInterval(() => {
    if (navigator.onLine) syncPendingSales()
  }, 5 * 60 * 1000)

  const channel = supabase
    .channel(`catalog:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` },
      () => { syncProductsFromCloud(businessId) },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `business_id=eq.${businessId}` },
      () => { syncProductsFromCloud(businessId) },
    )
    .subscribe()

  if (navigator.onLine) {
    syncPendingSales()
  } else {
    syncStore.setStatus('OFFLINE')
  }

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('focus', handleOnline)
    if (syncInterval) clearInterval(syncInterval)
    supabase.removeChannel(channel)
  }
}
