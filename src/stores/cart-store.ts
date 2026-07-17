"use client"

// ============================================================================
// QUANTIX CART ENGINE — the ONE cart for every Quantix workspace.
//
// This store is the single Cart Engine for the whole platform (Laundry,
// Commerce, Grocery, Bakery, Pharmacy, …). There is deliberately no per-product
// cart. Every workspace maps its purchasable things (services, garments,
// subscription plans, products, variants, add-ons) into the SAME `CartItem`
// shape via a small per-workspace "item-type adapter" (the reference adapter is
// src/lib/laundry-cart.ts), then relies on the identical add / update / remove /
// persist / checkout behaviour here. The cart only PREPARES an order — pricing,
// order creation, workflow, subscription and payment stay in each workspace's
// existing engines.
//
// See docs/quantix-cart-standard.md for the official standard.
// ============================================================================

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  productId: string
  variantId: string
  name: string
  variantName: string
  quantity: number
  price: number
  mrp: number
  image: string
  isVeg: boolean | null
  // ── Laundry storefront (single shared cart) — additive, optional; commerce
  //    product lines leave these undefined and behave exactly as before. ──
  kind?: "product" | "laundry" | "subscription"
  serviceId?: string
  serviceName?: string
  garmentId?: string
  pricingType?: string // PER_PIECE | PER_KG | FIXED
  unit?: string        // piece | kg | fixed
  gstPercent?: number
  weightKg?: number     // estimate for a PER_KG service line (billed after audit)
  billedAfterAudit?: boolean
  bagMode?: boolean     // Pickup-First (Bag) line: service only, no garments, counted at audit
  planId?: string       // subscription line
  billingCycle?: string
}

export interface StorePaymentGateway {
  id: string
  name: string
  gateway: string
  isTestMode: boolean
}

interface CartState {
  items: CartItem[]
  storeId: string | null
  storeDeliveryFee: number | null
  paymentGateways: StorePaymentGateway[]
  couponCode: string | null
  couponDiscount: number
  // ── Quantix Cart Engine metadata (see docs/quantix-cart-standard.md) ──
  // Business-type awareness + change tracking make the ONE cart future-ready for
  // abandoned-cart reminders, analytics and server/device sync WITHOUT redesign.
  businessType: string | null
  updatedAt: number
  setBusinessType: (businessType: string | null) => void
  // Server-sync seam: a future cart-persistence service hydrates the whole cart
  // for a logged-in customer via replaceItems(); guests stay on localStorage.
  replaceItems: (items: CartItem[]) => void
  setCartStoreId: (id: string) => void
  setStoreContext: (deliveryFee: number | null, minOrderAmount: number | null, paymentGateways?: StorePaymentGateway[]) => void
  switchStore: (newStoreId: string, deliveryFee: number | null, paymentGateways: StorePaymentGateway[]) => void
  restoreStore: (storeId: string, deliveryFee: number | null) => void
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void
  removeItem: (productId: string, variantId: string) => void
  updateQuantity: (productId: string, variantId: string, quantity: number) => void
  clearKind: (kind: NonNullable<CartItem["kind"]>) => void
  clearCart: () => void
  // Transient (never persisted): the Laundry Bag asks the storefront to open the
  // reused laundry checkout for the cart's contents. Bumped on "Proceed".
  laundryCheckoutTick: number
  requestLaundryCheckout: () => void
  applyCoupon: (code: string, discount: number) => void
  removeCoupon: () => void
  subtotal: () => number
  totalSavings: () => number
  totalItems: () => number
  deliveryFee: () => number
  total: () => number
}

export const useCartStore = create<CartState>()(
  persist(
  (set, get) => ({
  items: [],
  storeId: null,
  storeDeliveryFee: null,
  paymentGateways: [],
  couponCode: null,
  couponDiscount: 0,
  businessType: null,
  updatedAt: 0,

  setBusinessType: (businessType) => set({ businessType }),
  replaceItems: (items) => set({ items, updatedAt: Date.now() }),

  setCartStoreId: (id) => set({ storeId: id }),
  setStoreContext: (deliveryFee, _minOrderAmount, paymentGateways) =>
    set({ storeDeliveryFee: deliveryFee, paymentGateways: paymentGateways || [] }),
  switchStore: (newStoreId, deliveryFee, paymentGateways) =>
    set({ storeId: newStoreId, items: [], storeDeliveryFee: deliveryFee, paymentGateways, couponCode: null, couponDiscount: 0 }),
  restoreStore: (storeId, deliveryFee) =>
    set({ storeId, storeDeliveryFee: deliveryFee }),

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId
      )
      if (existing) {
        return {
          updatedAt: Date.now(),
          items: state.items.map((i) =>
            i.productId === item.productId && i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          ),
        }
      }
      return {
        updatedAt: Date.now(),
        items: [...state.items, { ...item, quantity: item.quantity || 1 }],
      }
    })
  },

  removeItem: (productId, variantId) => {
    set((state) => ({
      updatedAt: Date.now(),
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
      updatedAt: Date.now(),
      items: state.items.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity }
          : i
      ),
    }))
  },

  clearKind: (kind) => set((state) => ({ updatedAt: Date.now(), items: state.items.filter((i) => (i.kind || "product") !== kind) })),

  clearCart: () => set({ items: [], storeId: null, storeDeliveryFee: null, paymentGateways: [], couponCode: null, couponDiscount: 0, updatedAt: Date.now() }),

  laundryCheckoutTick: 0,
  requestLaundryCheckout: () => set((state) => ({ laundryCheckoutTick: state.laundryCheckoutTick + 1 })),

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
    if (subtotal === 0) return 0
    const storeFee = get().storeDeliveryFee
    if (storeFee !== null) return storeFee
    return subtotal < 500 ? 30 : 0
  },

  total: () => {
    const subtotal = get().subtotal()
    const deliveryFee = get().deliveryFee()
    const discount = get().couponDiscount
    return Math.max(0, subtotal + deliveryFee - discount)
  },
  }),
  {
    name: "quantix-cart-v1",
    partialize: (state) => ({
      items: state.items,
      storeId: state.storeId,
      storeDeliveryFee: state.storeDeliveryFee,
      couponCode: state.couponCode,
      couponDiscount: state.couponDiscount,
      businessType: state.businessType,
      updatedAt: state.updatedAt,
    }),
  }
  )
)
