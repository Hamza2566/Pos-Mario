import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatCurrency } from '@/lib/utils'
import { Package, Plus, Pencil, ToggleLeft, ToggleRight, Search, CookingPot } from 'lucide-react'
import { RecipeEditor } from '@/components/products/RecipeEditor'

interface Product {
  id: string
  name: string
  price: number
  cost_price: number
  category_id: string | null
  active: boolean
  image_url: string | null
  track_inventory: boolean
  category: { name: string } | null
}

export function ProductsPage() {
  const navigate = useNavigate()
  const { business } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggleTarget, setToggleTarget] = useState<Product | null>(null)
  const [recipeTarget, setRecipeTarget] = useState<Product | null>(null)

  useEffect(() => { if (business) loadProducts() }, [business])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, price, cost_price, category_id, active, image_url, track_inventory, category:categories(name)')
      .eq('business_id', business!.id)
      .order('name')
    setProducts((data as unknown as Product[]) ?? [])
    setLoading(false)
  }

  async function handleToggleActive() {
    if (!toggleTarget) return
    await supabase.from('products').update({ active: !toggleTarget.active }).eq('id', toggleTarget.id)
    setToggleTarget(null)
    loadProducts()
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Products"
        description="Manage products and ingredient recipes"
        icon={Package}
        action={
          <button
            id="products-add"
            onClick={() => navigate('/products/new')}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          id="products-search"
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your first product to start selling." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{formatCurrency(product.cost_price)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      product.active
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                    }`}>
                      {product.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setRecipeTarget(product)} title="Manage recipe" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                        <CookingPot className="h-3.5 w-3.5" /> Recipe
                      </button>
                      <button
                        id={`product-edit-${product.id}`}
                        onClick={() => navigate(`/products/${product.id}/edit`)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        id={`product-toggle-${product.id}`}
                        onClick={() => setToggleTarget(product)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {product.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={o => !o && setToggleTarget(null)}
        title={toggleTarget?.active ? 'Deactivate Product' : 'Activate Product'}
        description={`${toggleTarget?.name} will be ${toggleTarget?.active ? 'hidden from' : 'shown on'} the POS screen.`}
        confirmLabel={toggleTarget?.active ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.active ? 'destructive' : 'default'}
        onConfirm={handleToggleActive}
      />
      {recipeTarget && <RecipeEditor product={recipeTarget} onClose={() => setRecipeTarget(null)} />}
    </div>
  )
}
