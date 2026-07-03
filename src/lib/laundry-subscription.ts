// ============================================================================
// Laundry Subscription — cloth-allowance consumption engine.
//
// A cloth-allowance plan (e.g. "Monthly 70 Clothes Plan") gives a customer a
// QUANTITY of garments per billing cycle, usable across a limited number of
// orders. Allowance is consumed by garment COUNT — never by rupee value.
//
// This module is PURE: it decides how many submitted garments an order covers
// from the remaining allowance and which garments spill over as "extra". The
// extra garments are priced by the normal Billing Resolver (never a flat
// "extra cloth price") — see resolveSubscriptionOrder() in the server layer.
//
// Coverage policy: garments are covered in submission order (first line items
// first); whatever remains once the allowance is exhausted becomes chargeable
// extra. This is deterministic and matches the documented example
// (20 Shirts + 15 Pants, 30 allowance → 20 shirts + 10 pants covered,
//  5 pants extra).
// ============================================================================

export interface SubmittedItem {
  serviceId?: string | null
  garmentId?: string | null
  categoryId?: string | null
  quantity: number
}

export interface SubscriptionState {
  totalCredits: number      // cycle allowance (garment count), e.g. 70
  usedCredits: number       // allowance already consumed this cycle
  ordersUsed: number        // subscription orders already placed this cycle
  maxOrdersPerCycle: number | null // null = unlimited orders
}

export interface ExtraLine {
  serviceId: string | null
  garmentId: string | null
  categoryId: string | null
  quantity: number
}

export interface SubscriptionAllocation {
  // Order-limit gate — true means this order gets NO subscription coverage.
  blocked: boolean
  reason: string | null
  // Quantities
  submitted: number
  availableBefore: number   // allowance available before this order
  covered: number           // garments covered by the plan this order
  extra: number             // chargeable garments this order
  // Cycle state after applying this order (only when not blocked)
  usedAfter: number
  remainingAfter: number
  ordersUsedAfter: number
  // Extra garments to send through the normal Billing Resolver
  extraLines: ExtraLine[]
}

const q = (n: number | undefined | null) => (n != null && n > 0 ? Math.floor(n) : 0)

/**
 * Decide subscription coverage for one order. Pure — no pricing, no DB.
 * Extra garments (extraLines) must be priced by the Billing Resolver.
 */
export function computeSubscriptionAllocation(sub: SubscriptionState, items: SubmittedItem[]): SubscriptionAllocation {
  const submitted = items.reduce((s, it) => s + q(it.quantity), 0)
  const availableBefore = Math.max(0, sub.totalCredits - sub.usedCredits)
  const orderLimitReached = sub.maxOrdersPerCycle != null && sub.ordersUsed >= sub.maxOrdersPerCycle

  // Order limit reached OR no allowance left → nothing is covered; the whole
  // order is a normal (chargeable) order. We do NOT consume an order slot.
  if (orderLimitReached || availableBefore <= 0) {
    return {
      blocked: orderLimitReached,
      reason: orderLimitReached
        ? "You have used all subscription orders for this billing cycle. You can still place a normal laundry order at standard rates."
        : (availableBefore <= 0 ? "No subscription allowance remaining this cycle." : null),
      submitted,
      availableBefore,
      covered: 0,
      extra: submitted,
      usedAfter: sub.usedCredits,
      remainingAfter: availableBefore,
      ordersUsedAfter: sub.ordersUsed,
      extraLines: items
        .filter((it) => q(it.quantity) > 0)
        .map((it) => ({ serviceId: it.serviceId ?? null, garmentId: it.garmentId ?? null, categoryId: it.categoryId ?? null, quantity: q(it.quantity) })),
    }
  }

  // Cover garments in submission order until the allowance is exhausted.
  let remainingCoverage = Math.min(availableBefore, submitted)
  const covered = remainingCoverage
  const extra = submitted - covered
  const extraLines: ExtraLine[] = []
  for (const it of items) {
    const qty = q(it.quantity)
    if (qty <= 0) continue
    const cov = Math.min(qty, remainingCoverage)
    remainingCoverage -= cov
    const extraQty = qty - cov
    if (extraQty > 0) {
      extraLines.push({ serviceId: it.serviceId ?? null, garmentId: it.garmentId ?? null, categoryId: it.categoryId ?? null, quantity: extraQty })
    }
  }

  return {
    blocked: false,
    reason: null,
    submitted,
    availableBefore,
    covered,
    extra,
    usedAfter: sub.usedCredits + covered,
    remainingAfter: availableBefore - covered,
    ordersUsedAfter: sub.ordersUsed + 1,
    extraLines,
  }
}
