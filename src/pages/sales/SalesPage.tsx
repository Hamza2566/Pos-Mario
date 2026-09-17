import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from '@/lib/utils'
import { db } from '@/lib/db'
import { voidSale } from '@/lib/saleService'
import { Receipt, X } from 'lucide-react'
import type { LocalSale } from '@/types/local'

interface Sale {
  id: string
  sale_number: string | null
  total_amount: number
  subtotal: number
  discount_amount: number
  tax_amount: number
  payment_status: string
  sale_status: string
  created_at: string
  notes: string | null
  employee: { full_name: string } | null
  payments: { payment_method: string; amount: number; reference: string | null }[]
  items: {
    product_name_snapshot: string
    unit_price_snapshot: number
    price_version_used: number
    quantity: number
    discount_amount: number
    subtotal: number
  }[]
}

export function SalesPage() {
  const { profile, business } = useAuthStore()
  const isOwner = profile?.role === 'OWNER'
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today')
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [localPending, setLocalPending] = useState<LocalSale[]>([])

  useEffect(() => {
    if (!business) return
    loadSales()
  }, [business, dateFilter])

  async function loadSales() {
    setLoading(true)
    const now = new Date()
    let since: Date | null = null
    if (dateFilter === 'today') {
      since = new Date(now); since.setHours(0, 0, 0, 0)
    } else if (dateFilter === 'week') {
      since = new Date(now); since.setDate(since.getDate() - 7)
    } else if (dateFilter === 'month') {
      since = new Date(now); since.setMonth(since.getMonth() - 1)
    }

    let query = supabase
      .from('sales')
      .select(`
        id, sale_number, total_amount, subtotal, discount_amount, tax_amount,
        payment_status, sale_status, created_at, notes,
        employee:profiles!employee_id(full_name),
        payments(payment_method, amount, reference),
        items:sale_items(product_name_snapshot, unit_price_snapshot, price_version_used, quantity, discount_amount, subtotal)
      `)
      .eq('business_id', business!.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!isOwner) {
      query = query.eq('employee_id', profile!.id)
    }
    if (since) {
      query = query.gte('created_at', since.toISOString())
    }

    const { data } = await query
    setSales((data as unknown as Sale[]) ?? [])

    const pending = await db.sales
      .where('sync_status')
      .anyOf(['PENDING', 'SYNCING', 'FAILED'])
      .toArray()
    setLocalPending(pending.filter(s => s.business_id === business!.id))
    setLoading(false)
  }

  async function handleVoid() {
    if (!voidTarget) return
    setVoiding(true)
    try {
      await voidSale(voidTarget.id)
      setVoidTarget(null)
      setSelectedSale(null)
      await loadSales()
    } catch (err) {
      console.error(err)
    } finally {
      setVoiding(false)
    }
  }

  const filterTabs = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: '7 days' },
    { id: 'month', label: '30 days' },
    { id: 'all', label: 'All time' },
  ] as const

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Sales History"
        description={isOwner ? 'All sales for this business' : 'Your personal sales'}
        icon={Receipt}
      />

      {/* Filters */}
      <div className="flex gap-2">
        {filterTabs.map(tab => (
          <button
            key={tab.id}
            id={`sales-filter-${tab.id}`}
            onClick={() => setDateFilter(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              dateFilter === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {localPending.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-800">Waiting to sync ({localPending.length})</p>
          <p className="text-amber-700 text-xs mt-1">These sales are saved on this device and will upload when the connection is stable.</p>
          <ul className="mt-2 space-y-1 text-amber-900">
            {localPending.map(sale => (
              <li key={sale.id} className="flex justify-between gap-3">
                <span>{formatDateTime(sale.created_at)} · {PAYMENT_METHOD_LABELS[sale.payment_method] ?? sale.payment_method}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(sale.total_amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : sales.length === 0 ? (
        <EmptyState icon={Receipt} title="No sales found" description="Sales will appear here once completed." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Sale #</th>
                {isOwner && <th className="px-4 py-3 text-left">Employee</th>}
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <tr
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {sale.sale_number ?? '—'}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 font-medium">
                      {sale.employee?.full_name ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(sale.created_at)}</td>
                  <td className="px-4 py-3">
                    {(sale.payments ?? []).map(p => PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={sale.sale_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sale detail modal */}
      {selectedSale && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedSale(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="font-bold">{selectedSale.sale_number ?? 'Sale Detail'}</h2>
                  <p className="text-xs text-muted-foreground">{formatDateTime(selectedSale.created_at)}</p>
                </div>
                <button onClick={() => setSelectedSale(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  {selectedSale.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <div>
                        <p className="font-medium">{item.product_name_snapshot}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price_snapshot)}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>{formatCurrency(selectedSale.subtotal)}</span>
                  </div>
                  {selectedSale.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount</span><span>−{formatCurrency(selectedSale.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span><span>{formatCurrency(selectedSale.total_amount)}</span>
                  </div>
                </div>
                {selectedSale.notes && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                    Note: {selectedSale.notes}
                  </p>
                )}
                {isOwner && selectedSale.sale_status === 'COMPLETED' && (
                  <button
                    id="sale-void"
                    onClick={() => setVoidTarget(selectedSale)}
                    className="w-full rounded-lg border border-destructive/30 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Void this sale
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={o => !o && setVoidTarget(null)}
        title="Void sale"
        description={`${voidTarget?.sale_number ?? 'This sale'} will be marked voided and inventory will be restored where it was deducted. This cannot be undone.`}
        confirmLabel={voiding ? 'Voiding…' : 'Void sale'}
        variant="destructive"
        onConfirm={handleVoid}
      />
    </div>
  )
}
