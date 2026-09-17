import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { getDeviceId, multiplyDecimals, subtractDecimals } from '@/lib/utils'
import { syncPendingSales } from '@/lib/syncEngine'
import type { CartItem } from '@/store/cartStore'
import type { LocalSale } from '@/types/local'


export interface CreateSaleInput {
  businessId: string
  employeeId: string
  items: CartItem[]
  discountAmount: number
  paymentMethod: string
  paymentReference: string | null
  notes: string | null
}



/**
 * Create a sale.
 *
 * This is the unified sale creation entry point.
 * Regardless of network status, the sale is ALWAYS saved locally first.
 * If online, an immediate sync attempt is made.
 *
 * PRICE SAFETY:
 * - Online: Postgres RPC reads prices from the database (authoritative)
 * - Offline: Locally cached prices (from last sync) are used for the local record
 *   The price_version_used is recorded so price drift can be detected on sync
 *
 * IDEMPOTENCY:
 * - A UUID is generated before saving. The same UUID is sent to the RPC.
 * - If the network request times out and is retried, the RPC's existence
 *   check prevents duplicate records.
 */
export async function createSale(input: CreateSaleInput): Promise<LocalSale> {
  const saleId = uuidv4()
  const deviceId = getDeviceId()
  const now = new Date().toISOString()

  // Build local sale items with price snapshots captured NOW
  const localItems = input.items.map((item) => ({
    product_id: item.product_id,
    product_name_snapshot: item.product_name,
    unit_price_snapshot: item.unit_price,
    price_version_used: item.price_version,
    quantity: item.quantity,
    discount_amount: item.discount_amount,
    subtotal: subtractDecimals(
      multiplyDecimals(item.unit_price, item.quantity),
      item.discount_amount
    ),
  }))

  const subtotal = localItems.reduce((sum, i) => sum + i.subtotal, 0)
  const total = subtractDecimals(subtotal, input.discountAmount)

  const localSale: LocalSale = {
    id: saleId,
    business_id: input.businessId,
    employee_id: input.employeeId,
    device_id: deviceId,
    items: localItems,
    subtotal,
    discount_amount: input.discountAmount,
    tax_amount: 0,
    total_amount: total,
    payment_method: input.paymentMethod,
    payment_reference: input.paymentReference,
    notes: input.notes,
    created_at: now,
    sync_status: 'PENDING',
    sync_attempts: 0,
    last_sync_attempt: null,
    sync_error: null,
    sale_number: null,
  }

  // Step 1: Always save locally first
  await db.sales.add(localSale)

  // Step 2: If online, attempt immediate sync
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.rpc('complete_sale', {
        p_sale_id: saleId,
        p_employee_id: input.employeeId,
        p_business_id: input.businessId,
        p_device_id: deviceId,
        p_items: input.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
        })),
        p_payment_method: input.paymentMethod,
        p_payment_reference: input.paymentReference,
        p_sale_discount: input.discountAmount,
        p_notes: input.notes,
      })

      if (error) throw error

      // Update local record to SYNCED with server-assigned sale_number
      await db.sales.update(saleId, {
        sync_status: 'SYNCED',
        sync_error: null,
        sale_number: (data as { sale_number: string })?.sale_number ?? null,
      })

      const syncedSale = await db.sales.get(saleId)
      return syncedSale!
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed'
      // Sale is saved locally — sync engine will retry
      await db.sales.update(saleId, {
        sync_status: 'FAILED',
        sync_attempts: 1,
        last_sync_attempt: now,
        sync_error: errorMessage,
      })

      const failedSale = await db.sales.get(saleId)
      return failedSale!
    }
  }

  // Offline: trigger sync engine to pick it up when connectivity returns
  syncPendingSales().catch(() => {})
  return localSale
}

export async function voidSale(saleId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('void_sale', {
    p_sale_id: saleId,
    p_reason: reason ?? null,
  })
  if (error) throw error
}
