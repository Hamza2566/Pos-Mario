import { useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Printer, X, CheckCircle2, Clock } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { LocalSale } from '@/types/local'

interface ReceiptModalProps {
  sale: LocalSale
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReceiptModal({ sale, open, onOpenChange }: ReceiptModalProps) {
  const { business, profile } = useAuthStore()
  const printRef = useRef<HTMLDivElement>(null)

  if (!open) return null

  function handlePrint() {
    window.print()
  }

  const isPending = sale.sync_status !== 'SYNCED'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm print:hidden"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:items-start print:p-0">
        <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-full">

          {/* Actions (hide in print) */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border print:hidden">
            <div className="flex items-center gap-2">
              {isPending ? (
                <>
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">Saved offline</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">Sale complete</span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                id="receipt-print"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
              <button
                id="receipt-close"
                onClick={() => onOpenChange(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Receipt content */}
          <div ref={printRef} className="p-5 space-y-4 receipt-print">
            {/* Header */}
            <div className="text-center">
              <h3 className="text-base font-bold">{business?.name ?? 'Coffee Shop'}</h3>
              {business?.address && (
                <p className="text-xs text-muted-foreground">{business.address}</p>
              )}
              {business?.phone && (
                <p className="text-xs text-muted-foreground">{business.phone}</p>
              )}
              <div className="mt-2 flex items-center justify-center gap-2">
                <p className="text-xs text-muted-foreground">{formatDateTime(sale.created_at)}</p>
                <StatusBadge status={sale.sync_status} />
              </div>
              {profile && (
                <p className="text-xs text-muted-foreground">Served by: {profile.full_name}</p>
              )}
            </div>

            <div className="border-t border-dashed border-border" />

            {/* Items */}
            <div className="space-y-2">
              {sale.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name_snapshot}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.unit_price_snapshot)}
                      {item.discount_amount > 0 && ` − ${formatCurrency(item.discount_amount)}`}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatCurrency(item.subtotal)}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-border" />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span className="tabular-nums">−{formatCurrency(sale.discount_amount)}</span>
                </div>
              )}
              {sale.tax_amount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular-nums">{formatCurrency(sale.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Paid via</span>
                <span className="font-medium capitalize">
                  {sale.payment_method.toLowerCase().replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-border" />

            <p className="text-center text-xs text-muted-foreground">
              Thank you for your visit! ☕
            </p>

            {isPending && (
              <p className="text-center text-[10px] text-amber-600 bg-amber-50 rounded p-2">
                This sale was saved offline and will sync when connected.
              </p>
            )}
          </div>

          {/* New sale button */}
          <div className="px-5 pb-5 print:hidden">
            <button
              id="receipt-new-sale"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              New Sale
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
