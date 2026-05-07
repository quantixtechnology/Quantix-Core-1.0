"use client"

import { create } from "zustand"

export interface CartItem {
  productId: string
  variantId: string
  name: string
  variantName: string
  quantity: number
  price: number
  mrp: number
  image: string
  isVeg: boolean
}

interface CartState {
  items: CartItem[]
  couponCode: string | null
  couponDiscount: number
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  removeItem: (productId: string, variantId: string) => void
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  clearCart: () => void
  applyCoupon: (code: string, discount: number) => void
  removeCoupon: () => void
  subtotal: () => number
  totalSavings: () => number
  totalItems: () => number
  deliveryFee: () => number
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  couponCode: null,
  couponDiscount: 0,

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      )
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId && i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          ),
        }
      }
      return {
        items: [...state.items, { ...item, quantity: item.quantity || 1 }],
      }
    })
  },

  removeItem: (productId, variantId) => {
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId)
      ),
    }))
  },

  updateQuantity: (productId, variantId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId, variantId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity }
          : i
      ),
    }))
  },

  clearCart: () => set({ items: [], couponCode: null, couponDiscount: 0 }),

  applyCoupon: (code, discount) => set({ couponCode: code, couponDiscount: discount }),
  removeCoupon: () => set({ couponCode: null, couponDiscount: 0 }),

  subtotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  totalSavings: () => {
    return get().items.reduce(
      (sum, item) => sum + (item.mrp - item.price) * item.quantity,
      0
    )
  },

  totalItems: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0)
  },

  deliveryFee: () => {
    const subtotal = get().subtotal()
    return subtotal > 0 && subtotal < 500 ? 30 : 0
  },

  total: () => {
    const subtotal = get().subtotal()
    const deliveryFee = get().deliveryFee()
    const discount = get().couponDiscount
    return Math.max(0, subtotal + deliveryFee - discount)
  },
}))
