// ============================================================================
// Laundry cart — SHARED business logic for the ONE storefront cart.
//
// Both the Web Storefront and the Customer PWA use the single `useCartStore`
// (src/stores/cart-store.ts). This module is the only place that knows how a
// laundry Service+Garment selection or a Subscription Plan maps into a shared
// CartItem, and how the cart's laundry lines convert back into the payload the
// EXISTING laundry order/checkout APIs already accept. No new cart, no new API,
// no engine logic — pure mapping reused by every surface so Web and PWA build
// identical orders.
// ============================================================================
import type { CartItem } from "@/stores/cart-store"

export type CartItemInput = Omit<CartItem, "quantity"> & { quantity: number }

// A per-garment (PER_PIECE / FIXED) laundry line. Keyed by garment+service so
// the same garment under two services are distinct cart lines.
export function makeGarmentLine(o: {
  serviceId: string; serviceName: string; garmentId: string; garmentName: string
  unitPrice: number; unit?: string | null; pricingType?: string | null; gstPercent?: number | null; quantity: number
}): CartItemInput {
  // A garment priced per-kg carries a quantity for inventory but no booking
  // price — its amount is resolved by weight at Store Audit.
  const isKg = (o.unit || "piece") === "kg"
  return {
    kind: "laundry",
    productId: o.garmentId, variantId: o.serviceId,
    name: o.garmentName, variantName: o.serviceName,
    serviceId: o.serviceId, serviceName: o.serviceName, garmentId: o.garmentId,
    price: isKg ? 0 : o.unitPrice, mrp: isKg ? 0 : o.unitPrice, image: "", isVeg: null,
    unit: o.unit || "piece", pricingType: o.pricingType || "PER_PIECE", gstPercent: o.gstPercent ?? 0,
    billedAfterAudit: isKg || undefined,
    quantity: o.quantity,
  }
}

// A weight-based (PER_KG) service line — priced ONCE at Store Audit, so its cart
// price is 0 and it is flagged "billed after audit". Keyed by service.
export function makePerKgLine(o: {
  serviceId: string; serviceName: string; weightKg: number; unitPrice?: number | null; gstPercent?: number | null
}): CartItemInput {
  return {
    kind: "laundry",
    productId: `kg:${o.serviceId}`, variantId: o.serviceId,
    name: o.serviceName, variantName: `~${o.weightKg} kg (est.)`,
    serviceId: o.serviceId, serviceName: o.serviceName,
    price: 0, mrp: 0, image: "", isVeg: null,
    unit: "kg", pricingType: "PER_KG", gstPercent: o.gstPercent ?? 0,
    weightKg: o.weightKg, billedAfterAudit: true,
    quantity: 1,
  }
}

// A Pickup-First (Bag) line — the service ONLY, no garments and no price.
// One bag per service; garments are counted later at Store Audit.
export function makeBagLine(o: { serviceId: string; serviceName: string }): CartItemInput {
  return {
    kind: "laundry",
    productId: `bag:${o.serviceId}`, variantId: o.serviceId,
    name: o.serviceName, variantName: "Pickup bag · Cloth count would be post service",
    serviceId: o.serviceId, serviceName: o.serviceName,
    price: 0, mrp: 0, image: "", isVeg: null,
    bagMode: true, billedAfterAudit: true,
    quantity: 1,
  }
}

// A subscription plan line — always quantity 1, keyed by plan.
export function makeSubscriptionLine(o: { planId: string; name: string; price: number; billingCycle?: string | null }): CartItemInput {
  return {
    kind: "subscription",
    productId: `sub:${o.planId}`, variantId: "subscription",
    name: o.name, variantName: o.billingCycle ? o.billingCycle.toLowerCase() : "plan",
    planId: o.planId, price: o.price, mrp: o.price, image: "", isVeg: null,
    billingCycle: o.billingCycle || undefined,
    quantity: 1,
  }
}

export const isLaundryLine = (i: CartItem) => i.kind === "laundry"
export const isSubscriptionLine = (i: CartItem) => i.kind === "subscription"
export const laundryLines = (items: CartItem[]) => items.filter(isLaundryLine)
export const subscriptionLine = (items: CartItem[]) => items.find(isSubscriptionLine) || null
export const hasLaundry = (items: CartItem[]) => items.some(isLaundryLine)

// Convert cart laundry lines into the items array the existing laundry order /
// checkout APIs accept: {serviceId, garmentId, quantity} for piece/fixed lines
// and {serviceId, garmentId:null, weightKg} for a weight-based line.
export function cartToOrderItems(items: CartItem[]): Array<{ serviceId: string; garmentId: string | null; quantity?: number; weightKg?: number }> {
  return laundryLines(items)
    .filter((i) => !i.bagMode) // Bag lines carry no garments/price → they become order SERVICES, not items.
    .map((i) =>
      i.garmentId
        ? { serviceId: i.serviceId as string, garmentId: i.garmentId, quantity: i.quantity }      // per-garment (piece or per-kg garment)
        : { serviceId: i.serviceId as string, garmentId: null, weightKg: i.weightKg || 0 },        // whole-service PER_KG mode
    )
}

// Pickup-First (Bag) services in the cart → order service lines (no items).
export const cartBagServices = (items: CartItem[]) =>
  laundryLines(items).filter((i) => i.bagMode).map((i) => ({ serviceId: i.serviceId as string, serviceName: i.serviceName || "Service" }))

// Booking subtotal = priced lines only (weight-based lines are billed after audit → price 0).
export const laundryPieceSubtotal = (items: CartItem[]) =>
  laundryLines(items).reduce((s, i) => s + i.price * i.quantity, 0)

export const cartHasKgPortion = (items: CartItem[]) => laundryLines(items).some((i) => i.billedAfterAudit || i.pricingType === "PER_KG" || i.unit === "kg")

// Group laundry lines by service → ordered [{serviceId, serviceName, lines}] so
// the Bag + checkout review show items GROUPED BY SERVICE, never a flat list.
export function groupLaundryByService(items: CartItem[]): { serviceId: string; serviceName: string; lines: CartItem[] }[] {
  const map = new Map<string, { serviceId: string; serviceName: string; lines: CartItem[] }>()
  for (const l of laundryLines(items)) {
    const key = l.serviceId || "svc"
    if (!map.has(key)) map.set(key, { serviceId: key, serviceName: l.serviceName || "Service", lines: [] })
    map.get(key)!.lines.push(l)
  }
  return [...map.values()]
}
