// Server-side billing resolution. The order API calls this so prices are
// resolved authoritatively from the Pricing Engine on the server (the client
// never supplies prices). Returns the quote plus per-line labels ready to
// persist as the order's financial snapshot.
import { prisma } from "@/lib/prisma"
import {
  computeQuote, type PricingRule, type BillingContext, type BillingLineInput, type BillingQuote,
} from "@/lib/laundry-billing"

export interface ResolvedItemInput {
  serviceId?: string | null
  garmentId?: string | null
  quantity?: number
  weightKg?: number
}

export interface PersistableLine {
  serviceId: string | null
  serviceName: string
  garmentId: string | null
  garmentName: string
  categoryId: string | null
  pricingRuleId: string | null
  pricingType: string
  quantity: number
  weightKg: number
  unitPrice: number
  lineAmount: number
  gstPercent: number
  gstAmount: number
  discount: number
  total: number
}

// Map the order channel to the customer type the Pricing Engine matches on.
export function orderTypeToCustomerType(orderType: string): string {
  switch (orderType) {
    case "HOME_PICKUP": return "PICKUP"
    case "CORPORATE": return "CORPORATE"
    case "SUBSCRIPTION": return "SUBSCRIPTION"
    case "STORE_DROP":
    case "WALK_IN":
    default: return "WALK_IN"
  }
}

export async function resolveOrderBilling(
  businessId: string,
  ctx: BillingContext,
  items: ResolvedItemInput[],
): Promise<{ quote: BillingQuote; lines: PersistableLine[] }> {
  const [rules, services, garments] = await Promise.all([
    prisma.laundryPricingRule.findMany({ where: { businessId, isActive: true } }),
    prisma.laundryService.findMany({ where: { businessId }, select: { id: true, name: true } }),
    prisma.laundryGarment.findMany({ where: { businessId }, select: { id: true, name: true, categoryId: true } }),
  ])
  const svcMap = new Map(services.map((s) => [s.id, s]))
  const grmMap = new Map(garments.map((g) => [g.id, g]))

  // categoryId for rule matching is taken from the garment master (authoritative).
  const lineInputs: BillingLineInput[] = items.map((it) => {
    const g = it.garmentId ? grmMap.get(it.garmentId) : null
    return {
      serviceId: it.serviceId || null,
      garmentId: it.garmentId || null,
      categoryId: g?.categoryId || null,
      quantity: it.quantity,
      weightKg: it.weightKg,
    }
  })

  const quote = computeQuote(rules as unknown as PricingRule[], lineInputs, ctx)

  const lines: PersistableLine[] = quote.lines.map((l, i) => {
    const it = items[i]
    const g = it.garmentId ? grmMap.get(it.garmentId) : null
    return {
      serviceId: it.serviceId || null,
      serviceName: (it.serviceId && svcMap.get(it.serviceId)?.name) || "Service",
      garmentId: it.garmentId || null,
      garmentName: (it.garmentId && g?.name) || "Garment",
      categoryId: g?.categoryId || null,
      pricingRuleId: l.matchedRuleId,
      pricingType: l.pricingType || "PER_PIECE",
      quantity: it.quantity || 0,
      weightKg: it.weightKg || 0,
      unitPrice: l.unitPrice,
      lineAmount: l.baseAmount,
      gstPercent: l.gstPercent,
      gstAmount: l.gstAmount,
      discount: 0,
      total: l.lineTotal,
    }
  })

  return { quote, lines }
}
