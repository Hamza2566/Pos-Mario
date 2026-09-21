import { create } from 'zustand'
import { multiplyDecimals, subtractDecimals, addDecimals } from '@/lib/utils'

export interface CartItem {
  product_id: string
  product_name: string
  unit_price: number
  price_version: number
  quantity: number
  /** Item-level discount in currency units */
  discount_amount: number
  /** (unit_price * quantity) - discount_amount */
  subtotal: number
}

interface CartState {
  items: CartItem[]
  /** Sale-level discount in currency units */
  saleDiscount: number

  // Derived totals (computed from items + saleDiscount)
  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number

  // Actions
  addItem: (item: { product_id: string; product_name: string; unit_price: number; price_version: number }) => void
  removeItem: (product_id: string) => void
  incrementItem: (product_id: string) => void
  decrementItem: (product_id: string) => void
  setDiscount: (amount: number) => void
  clearCart: () => void
  loadFromDraft: (items: CartItem[], saleDiscount: number) => void
}

function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => addDecimals(sum, i.subtotal), 0)
}

function computeItemSubtotal(unit_price: number, quantity: number, discount: number): number {
  return subtractDecimals(multiplyDecimals(unit_price, quantity), discount)
}

function deriveTotals(items: CartItem[], saleDiscount: number) {
  const subtotal = computeSubtotal(items)
  const discountTotal = saleDiscount
  const taxTotal = 0
  const grandTotal = Math.max(subtractDecimals(subtotal, discountTotal) + taxTotal, 0)
  return { subtotal, discountTotal, taxTotal, grandTotal }
}

export const useCartStore = create<CartState>()((set) => ({
  items: [],
  saleDiscount: 0,
  subtotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 0,

  addItem: ({ product_id, product_name, unit_price, price_version }) => {
    set((state) => {
      const existing = state.items.find(i => i.product_id === product_id)
      let newItems: CartItem[]
      if (existing) {
        newItems = state.items.map(i =>
          i.product_id === product_id
            ? { ...i, quantity: i.quantity + 1, subtotal: computeItemSubtotal(i.unit_price, i.quantity + 1, i.discount_amount) }
            : i
        )
      } else {
        const newItem: CartItem = {
          product_id, product_name, unit_price, price_version,
          quantity: 1, discount_amount: 0,
          subtotal: computeItemSubtotal(unit_price, 1, 0),
        }
        newItems = [...state.items, newItem]
      }
      return { items: newItems, ...deriveTotals(newItems, state.saleDiscount) }
    })
  },

  incrementItem: (product_id) => {
    set((state) => {
      const newItems = state.items.map(i =>
        i.product_id === product_id
          ? { ...i, quantity: i.quantity + 1, subtotal: computeItemSubtotal(i.unit_price, i.quantity + 1, i.discount_amount) }
          : i
      )
      return { items: newItems, ...deriveTotals(newItems, state.saleDiscount) }
    })
  },

  decrementItem: (product_id) => {
    set((state) => {
      const item = state.items.find(i => i.product_id === product_id)
      if (!item) return state
      let newItems: CartItem[]
      if (item.quantity <= 1) {
        newItems = state.items.filter(i => i.product_id !== product_id)
      } else {
        newItems = state.items.map(i =>
          i.product_id === product_id
            ? { ...i, quantity: i.quantity - 1, subtotal: computeItemSubtotal(i.unit_price, i.quantity - 1, i.discount_amount) }
            : i
        )
      }
      return { items: newItems, ...deriveTotals(newItems, state.saleDiscount) }
    })
  },

  removeItem: (product_id) => {
    set((state) => {
      const newItems = state.items.filter(i => i.product_id !== product_id)
      return { items: newItems, ...deriveTotals(newItems, state.saleDiscount) }
    })
  },

  setDiscount: (amount) => {
    set((state) => {
      const saleDiscount = Math.max(0, amount)
      return { saleDiscount, ...deriveTotals(state.items, saleDiscount) }
    })
  },

  clearCart: () => set({
    items: [],
    saleDiscount: 0,
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 0,
  }),

  loadFromDraft: (items, saleDiscount) => {
    set({
      items,
      saleDiscount,
      ...deriveTotals(items, saleDiscount),
    })
  },
}))
