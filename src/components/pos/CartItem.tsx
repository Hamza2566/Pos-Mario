import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import { Minus, Plus, Trash2 } from 'lucide-react'
import type { CartItem as CartItemType } from '@/store/cartStore'

interface CartItemProps {
  item: CartItemType
}

export function CartItem({ item }: CartItemProps) {
  const { incrementItem, decrementItem, removeItem } = useCartStore()

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.product_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.unit_price)} each</p>
        {item.discount_amount > 0 && (
          <p className="text-xs text-emerald-600 mt-0.5">
            −{formatCurrency(item.discount_amount)} discount
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Decrement */}
        <button
          id={`cart-decrement-${item.product_id}`}
          onClick={() => decrementItem(item.product_id)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          aria-label="Remove one"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>

        {/* Increment */}
        <button
          id={`cart-increment-${item.product_id}`}
          onClick={() => incrementItem(item.product_id)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          aria-label="Add one more"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        {/* Remove */}
        <button
          id={`cart-remove-${item.product_id}`}
          onClick={() => removeItem(item.product_id)}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Line total */}
      <div className="w-20 text-right flex-shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {formatCurrency((item.unit_price * item.quantity) - item.discount_amount)}
        </p>
      </div>
    </div>
  )
}
