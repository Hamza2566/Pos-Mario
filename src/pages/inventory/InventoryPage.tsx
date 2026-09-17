import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Warehouse, Plus, AlertTriangle, Loader2, X } from 'lucide-react'

interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  minimum_stock: number
  cost_per_unit: number
  active: boolean
}

export function InventoryPage() {
  const { business, profile } = useAuthStore()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustType, setAdjustType] = useState<'PURCHASE' | 'ADJUSTMENT' | 'WASTE'>('PURCHASE')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', minimum_stock: '0', cost_per_unit: '0' })
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => { if (business) load() }, [business])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('business_id', business!.id)
      .eq('active', true)
      .order('name')
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleAdjust() {
    if (!adjustTarget || !business) return
    const qty = parseFloat(adjustQty)
    if (isNaN(qty) || qty === 0) return
    setAdjustSaving(true)

    const quantityChange =
      adjustType === 'PURCHASE' ? Math.abs(qty)
      : adjustType === 'WASTE' ? -Math.abs(qty)
      : qty

    await Promise.all([
      supabase.from('inventory_transactions').insert({
        business_id: business.id,
        item_id: adjustTarget.id,
        transaction_type: adjustType,
        quantity_change: quantityChange,
        notes: adjustNotes || null,
        created_by: profile?.id ?? null,
      }),
      supabase.from('inventory_items').update({
        quantity: adjustTarget.quantity + quantityChange,
        updated_at: new Date().toISOString(),
      }).eq('id', adjustTarget.id),
    ])

    setAdjustSaving(false)
    setAdjustTarget(null)
    setAdjustQty('')
    setAdjustNotes('')
    load()
  }

  async function handleAddItem() {
    if (!business || !newItem.name.trim()) return
    setAddSaving(true)
    await supabase.from('inventory_items').insert({
      business_id: business.id,
      name: newItem.name.trim(),
      unit: newItem.unit,
      quantity: 0,
      minimum_stock: parseFloat(newItem.minimum_stock) || 0,
      cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
      active: true,
    })
    setAddSaving(false)
    setAddOpen(false)
    setNewItem({ name: '', unit: 'kg', minimum_stock: '0', cost_per_unit: '0' })
    load()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Inventory"
        description="Track stock levels for your supplies"
        icon={Warehouse}
        action={
          <button id="inventory-add" onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />Add Item
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Warehouse} title="No inventory items" description="Add items to track your supplies." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Min. Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isLow = item.quantity <= item.minimum_stock && item.minimum_stock > 0
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{item.minimum_stock} {item.unit}</td>
                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <AlertTriangle className="h-3 w-3" />Low
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button id={`inv-adjust-${item.id}`} onClick={() => { setAdjustTarget(item); setAdjustQty(''); setAdjustNotes(''); setAdjustType('PURCHASE') }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                        Adjust
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust modal */}
      {adjustTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setAdjustTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Adjust Stock — {adjustTarget.name}</h2>
                <button onClick={() => setAdjustTarget(null)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">Current: <span className="font-medium text-foreground">{adjustTarget.quantity} {adjustTarget.unit}</span></p>
              <div className="flex gap-2">
                {(['PURCHASE', 'ADJUSTMENT', 'WASTE'] as const).map(t => (
                  <button key={t} id={`inv-type-${t.toLowerCase()}`} onClick={() => setAdjustType(t)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${adjustType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {t === 'PURCHASE' ? '+ In' : t === 'WASTE' ? '− Waste' : '± Adjust'}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="inv-qty" className="block text-sm font-medium mb-1.5">Quantity ({adjustTarget.unit})</label>
                <input id="inv-qty" type="number" min="0" step="0.001" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label htmlFor="inv-notes" className="block text-sm font-medium mb-1.5">Notes (optional)</label>
                <input id="inv-notes" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g. Weekly purchase" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAdjustTarget(null)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button id="inv-adjust-save" onClick={handleAdjust} disabled={adjustSaving || !adjustQty}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {adjustSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Adjustment
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add item modal */}
      {addOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Add Inventory Item</h2>
              <div>
                <label htmlFor="inv-item-name" className="block text-sm font-medium mb-1.5">Name *</label>
                <input id="inv-item-name" value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g. Coffee Beans" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="inv-item-unit" className="block text-sm font-medium mb-1.5">Unit</label>
                  <input id="inv-item-unit" value={newItem.unit} onChange={e => setNewItem(n => ({ ...n, unit: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label htmlFor="inv-item-min" className="block text-sm font-medium mb-1.5">Min Stock</label>
                  <input id="inv-item-min" type="number" min="0" value={newItem.minimum_stock} onChange={e => setNewItem(n => ({ ...n, minimum_stock: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label htmlFor="inv-item-cost" className="block text-sm font-medium mb-1.5">Cost/Unit</label>
                  <input id="inv-item-cost" type="number" min="0" value={newItem.cost_per_unit} onChange={e => setNewItem(n => ({ ...n, cost_per_unit: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAddOpen(false)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
                <button id="inv-item-save" onClick={handleAddItem} disabled={addSaving || !newItem.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
