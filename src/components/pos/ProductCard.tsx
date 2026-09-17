import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Coffee, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LocalProduct } from '@/types/local'

interface ProductCardProps {
  product: LocalProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore(s => s.addItem)

  function handleAdd() {
    addItem({
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      price_version: product.price_version,
    })
  }

  return (
    <button
      id={`product-${product.id}`}
      onClick={handleAdd}
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card text-left',
        'hover:border-primary/40 hover:shadow-md hover:shadow-primary/5',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'transition-all duration-200 overflow-hidden active:scale-95',
      )}
    >
      {/* Product image */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted flex items-center justify-center relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <Coffee className="h-8 w-8" />
          </div>
        )}
        {/* Add overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-primary/0 group-hover:bg-primary/10 transition-colors duration-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/0 group-hover:bg-primary text-primary/0 group-hover:text-primary-foreground scale-75 group-hover:scale-100 transition-all duration-200 shadow-lg">
            <Plus className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Product info */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-semibold text-card-foreground leading-tight line-clamp-2">
          {product.name}
        </p>
        <p className="mt-auto pt-2 text-base font-bold text-primary">
          {formatCurrency(product.price)}
        </p>
      </div>
    </button>
  )
}
