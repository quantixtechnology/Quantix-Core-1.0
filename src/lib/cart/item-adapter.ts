// ============================================================================
// QUANTIX CART — item-type adapter contract.
//
// The Quantix Cart Engine (src/stores/cart-store.ts) is ONE cart that stores a
// single `CartItem` shape. Each workspace (Laundry, Commerce, Bakery, Pharmacy,
// …) provides a small ADAPTER that (a) maps its purchasable things into a
// CartItem and (b) maps the cart's lines back into the payload its EXISTING
// order/checkout API already accepts. Adapters contain NO pricing/order logic —
// they only translate. This is the template for every future workspace.
//
// Reference implementation: src/lib/laundry-cart.ts (Laundry — services,
// garments, subscription plans). New workspaces add a sibling file following
// this same contract; they never add a new cart or a new checkout.
//
// See docs/quantix-cart-standard.md for the official standard.
// ============================================================================
import type { CartItem } from "@/stores/cart-store"

// Every kind of line the ONE cart can hold, across all workspaces. Extend this
// union (never add a parallel cart) when a workspace introduces a new item type.
export type CartItemKind = NonNullable<CartItem["kind"]>

export type CartItemInput = Omit<CartItem, "quantity"> & { quantity: number }

// The shape a workspace adapter implements. `toCartItems` turns a workspace
// selection into shared cart lines; `toOrderPayload` turns the cart's lines back
// into whatever that workspace's existing order API expects (kept `unknown` so
// each workspace keeps its own payload type — the cart never dictates it).
export interface CartItemAdapter<Selection, OrderPayloadItem> {
  readonly businessType: string           // e.g. "LAUNDRY", "COMMERCE"
  toCartItems(selection: Selection): CartItemInput[]
  toOrderPayload(items: CartItem[]): OrderPayloadItem[]
}

// Shared helpers usable by any adapter.
export const itemsOfKind = (items: CartItem[], kind: CartItemKind) => items.filter((i) => (i.kind || "product") === kind)
export const cartLineKey = (i: Pick<CartItem, "productId" | "variantId">) => `${i.productId}::${i.variantId}`
