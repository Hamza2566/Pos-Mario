// ─── Supabase Database Types ──────────────────────────────────────────────────
// Hand-written for V1. Run `supabase gen types typescript` after connecting.

export type Role = 'OWNER' | 'EMPLOYEE'

export type SaleStatus = 'COMPLETED' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type PaymentMethod = 'CASH' | 'TELEBIRR' | 'CBE_BIRR' | 'CARD' | 'OTHER'
export type InventoryTransactionType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'WASTE'
  | 'RETURN'
  | 'MANUAL_CORRECTION'

// ─── Cloud (Supabase) Entity Types ────────────────────────────────────────────

export interface Business {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  currency: string
  logo_url: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  auth_user_id: string
  business_id: string
  full_name: string
  role: Role
  phone: string | null
  avatar_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  business_id: string
  name: string
  description: string | null
  color: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  business_id: string
  category_id: string | null
  name: string
  description: string | null
  image_url: string | null
  sku: string | null
  price: number
  cost_price: number
  price_version: number
  active: boolean
  track_inventory: boolean
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  business_id: string
  sale_number: string
  employee_id: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_status: PaymentStatus
  sale_status: SaleStatus
  device_id: string
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields (not in DB)
  employee?: Pick<Profile, 'id' | 'full_name'>
  payments?: Payment[]
  sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string | null
  product_name_snapshot: string
  unit_price_snapshot: number
  price_version_used: number
  quantity: number
  discount_amount: number
  subtotal: number
  created_at: string
}

export interface Payment {
  id: string
  sale_id: string
  business_id: string
  payment_method: PaymentMethod
  amount: number
  reference: string | null
  received_by: string | null
  created_at: string
}

export interface InventoryItem {
  id: string
  business_id: string
  name: string
  unit: string
  quantity: number
  minimum_stock: number
  cost_per_unit: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryTransaction {
  id: string
  business_id: string
  item_id: string
  transaction_type: InventoryTransactionType
  quantity_change: number
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Expense {
  id: string
  business_id: string
  created_by: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  created_at: string
}

export interface ActivityLog {
  id: string
  business_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Joined
  profile?: Pick<Profile, 'id' | 'full_name'>
}

// ─── RPC Payload Types ────────────────────────────────────────────────────────

export interface CompleteSaleItem {
  product_id: string
  quantity: number
  discount_amount: number
}

export interface CompleteSalePayload {
  p_sale_id: string
  p_employee_id: string
  p_business_id: string
  p_device_id: string
  p_items: CompleteSaleItem[]
  p_payment_method: PaymentMethod
  p_payment_reference: string | null
  p_sale_discount: number
  p_notes: string | null
}

// ─── Dashboard / Report Types ─────────────────────────────────────────────────

export interface DashboardStats {
  total_revenue: number
  order_count: number
  avg_order_value: number
  cash_total: number
  telebirr_total: number
  cbe_birr_total: number
  card_total: number
  other_total: number
}

export interface EmployeePerformance {
  employee_id: string
  full_name: string
  order_count: number
  total_revenue: number
  avg_sale_value: number
  void_count: number
  refund_count: number
}

export interface ProductPerformance {
  product_id: string
  product_name: string
  quantity_sold: number
  total_revenue: number
}
