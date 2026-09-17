import { ProductCard } from './ProductCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { PackageSearch } from 'lucide-react'
import type { LocalProduct } from '@/types/local'

interface ProductGridProps {
  products: LocalProduct[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No products found"
        description="Try a different search or category, or add products from the management panel."
      />
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
