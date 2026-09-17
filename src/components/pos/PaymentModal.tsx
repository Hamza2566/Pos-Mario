import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { createSale } from '@/lib/saleService'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Banknote, Smartphone, CreditCard, X } from 'lucide-react'
import type { LocalSale } from '@/types/local'

const PAYMENT_METHODS = [
  { id: 'CASH',      label: 'Cash',       icon: Banknote,    color: 'emerald' },
  { id: 'TELEBIRR',  label: 'TeleBirr',   icon: Smartphone,  color: 'purple' },
  { id: 'CBE_BIRR',  label: 'CBE Birr',   icon: Smartphone,  color: 'blue' },
  { id: 'CARD',      label: 'Card',       icon: CreditCard,  color: 'orange' },
  { id: 'OTHER',     label: 'Other',      icon: CreditCard,  color: 'slate' },
] as const

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (sale: LocalSale) => void
}

export function PaymentModal({ open, onOpenChange, onComplete }: PaymentModalProps) {
  const { items, grandTotal, discountTotal } = useCartStore()
  const { profile, business } = useAuthStore()
  const [method, setMethod] = useState<string>('CASH')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleCharge() {
    if (!profile || !business) return
    setError(null)
    setLoading(true)
    try {
      const sale = await createSale({
        items,
        discountAmount: discountTotal,
        paymentMethod: method,
        paymentReference: reference || null,
        notes: notes || null,
        employeeId: profile.id,
        businessId: business.id,
      })
      onComplete(sale)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => !loading && onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold">Payment</h2>
            <button
              id="payment-close"
              onClick={() => !loading && onOpenChange(false)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Amount */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-4xl font-bold text-primary mt-1">{formatCurrency(grandTotal)}</p>
              {discountTotal > 0 && (
                <p className="text-xs text-emerald-600 mt-1">Includes {formatCurrency(discountTotal)} discount</p>
              )}
            </div>

            {/* Payment method */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(pm => {
                  const Icon = pm.icon
                  const isActive = method === pm.id
                  return (
                    <button
                      key={pm.id}
                      id={`payment-method-${pm.id.toLowerCase()}`}
                      onClick={() => setMethod(pm.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                        isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{pm.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reference (optional) */}
            {method !== 'CASH' && (
              <div>
                <label htmlFor="payment-reference" className="block text-sm font-medium text-foreground mb-1.5">
                  Reference / Transaction ID <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="payment-reference"
                  type="text"
                  placeholder="e.g. TB123456"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
            )}

            {/* Notes (optional) */}
            <div>
              <label htmlFor="payment-notes" className="block text-sm font-medium text-foreground mb-1.5">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="payment-notes"
                type="text"
                placeholder="e.g. takeaway, special request…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2 border border-destructive/20">
                {error}
              </p>
            )}

            {/* Charge button */}
            <button
              id="payment-charge"
              onClick={handleCharge}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing…
                </>
              ) : (
                `Charge ${formatCurrency(grandTotal)}`
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
