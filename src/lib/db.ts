import Dexie, { Table } from 'dexie'
import type { LocalProduct, LocalCategory, LocalSale } from '@/types/local'

/**
 * POS local database using Dexie (IndexedDB abstraction).
 *
 * This database is the primary data source for the POS screen.
 * It operates independently of network connectivity.
 *
 * Design principles:
 * - Products and categories are synced FROM Supabase on login / Realtime update
 * - Sales are created locally first, then synced TO Supabase when online
 * - Sync state (PENDING/SYNCING/SYNCED/FAILED) lives ONLY here, never in Supabase
 * - UUIDs are the authoritative identity — never use local auto-increment IDs
 */
export class PosDatabase extends Dexie {
  products!: Table<LocalProduct>
  categories!: Table<LocalCategory>
  sales!: Table<LocalSale>

  constructor() {
    super('pos_mario_db')

    this.version(1).stores({
      // Indexed fields (keep minimal — only what's queried)
      products:   'id, business_id, category_id, active',
      categories: 'id, business_id, active',
      sales:      'id, business_id, sync_status, employee_id, created_at',
    })
  }
}

export const db = new PosDatabase()
