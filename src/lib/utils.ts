import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a monetary value.
 * Always uses the configured currency symbol.
 * Never uses floating-point for display — values come from NUMERIC in Postgres.
 */
export function formatCurrency(amount: number, currency = 'ETB'): string {
  return `${amount.toFixed(2)} ${currency}`
}

/**
 * Format a date/time for display in the UI.
 */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
}

export function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a')
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

/**
 * Generate a stable device ID for this browser/device.
 * Stored in localStorage so it persists across sessions.
 * Used to identify which device created an offline sale.
 */
export function getDeviceId(): string {
  const key = 'pos_device_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `POS-${crypto.randomUUID().split('-')[0].toUpperCase()}`
    localStorage.setItem(key, id)
  }
  return id
}

/**
 * Safe addition for display totals.
 * All authoritative totals come from the Postgres RPC.
 * Client-side totals are for display only.
 */
export function addDecimals(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100
}

export function subtractDecimals(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100
}

export function multiplyDecimals(a: number, b: number): number {
  return Math.round(a * b * 100) / 100
}

/** Payment method display labels */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  TELEBIRR: 'Telebirr',
  CBE_BIRR: 'CBE Birr',
  CARD: 'Card',
  OTHER: 'Other',
}

/** Sale status color mapping */
export const SALE_STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'text-green-700 bg-green-50 border-green-200',
  VOIDED: 'text-red-700 bg-red-50 border-red-200',
  REFUNDED: 'text-orange-700 bg-orange-50 border-orange-200',
  PARTIALLY_REFUNDED: 'text-yellow-700 bg-yellow-50 border-yellow-200',
}

/** Sync status color mapping */
export const SYNC_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-700 bg-yellow-50',
  SYNCING: 'text-blue-700 bg-blue-50',
  SYNCED: 'text-green-700 bg-green-50',
  FAILED: 'text-red-700 bg-red-50',
}
