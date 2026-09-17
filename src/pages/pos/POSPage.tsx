import { useState, useMemo } from 'react'
import { useProducts } from '@/hooks/useProducts'
import { useCartStore } from '@/store/cartStore'
import { CategoryFilter } from '@/components/pos/CategoryFilter'
import { ProductGrid } from '@/components/pos/ProductGrid'
import { Cart } from '@/components/pos/Cart'
import { PaymentModal } from '@/components/pos/PaymentModal'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { Search } from 'lucide-react'
import type { LocalSale } from '@/types/local'

export function POSPage() {
  const { products, categories } = useProducts()
  const { clearCart } = useCartStore()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState<LocalSale | null>(null)

  const filteredProducts = useMemo(() => {
    let result = products ?? []
    if (activeCategory) result = result.filter(p => p.category_id === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }
    return result
  }, [products, activeCategory, search])

  function handleSaleComplete(sale: LocalSale) {
    clearCart()
    setPaymentOpen(false)
    setCompletedSale(sale)
  }

  return (
    <div className="flex h-full flex-col md:flex-row overflow-hidden">
      {/* Left: Product Browser */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-border">
        {/* Search */}
        <div className="px-4 pt-4 pb-3 bg-background sticky top-0 z-10 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="pos-search"
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted/30 pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          {/* Category filter */}
          <div className="mt-3">
            <CategoryFilter
              categories={categories ?? []}
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <ProductGrid products={filteredProducts} />
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full md:w-96 flex-shrink-0 flex flex-col border-t md:border-t-0 border-border max-h-96 md:max-h-full">
        <Cart onCheckout={() => setPaymentOpen(true)} />
      </div>

      {/* Payment modal */}
      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onComplete={handleSaleComplete}
      />

      {/* Receipt modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          open={!!completedSale}
          onOpenChange={open => !open && setCompletedSale(null)}
        />
      )}
    </div>
  )
}
