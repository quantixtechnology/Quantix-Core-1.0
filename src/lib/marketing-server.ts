// Server helpers for the Marketing Engine (prisma-backed). Keeps src/lib/marketing.ts
// pure. Resolves the business, builds the evaluation context (reusing the
// existing Customer engine), and loads live promotions with their rules.
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { parseTags } from "@/lib/laundry-customer"
import type { PromoContext, PromotionLite } from "@/lib/marketing"

export async function resolveMarketingBusinessId(businessId: string): Promise<string> {
  const r = await resolveLaundryBusiness(businessId)
  return r?.platformBusinessId || businessId
}

// Build the rule-engine context. Facts come from the request (cart) + the
// existing Customer record (tier/tags/contact). Never mutates anything.
export async function buildContext(body: Record<string, unknown>): Promise<PromoContext> {
  const ctx: PromoContext = {
    workspaceType: (body.workspaceType as string) ?? null,
    applyTo: (body.applyTo as string) || "ORDER",
    orderValue: Number(body.orderValue) || 0,
    firstOrder: body.firstOrder === true,
    lifetimeOrders: body.lifetimeOrders != null ? Number(body.lifetimeOrders) : undefined,
    lifetimeSpend: body.lifetimeSpend != null ? Number(body.lifetimeSpend) : undefined,
    subscriptionActive: body.subscriptionActive === true,
  }
  if (body.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: String(body.customerId) }, select: { loyaltyTier: true, tags: true, phone: true, email: true } })
    if (c) {
      ctx.customerTier = c.loyaltyTier
      ctx.customerTags = parseTags(c.tags)
      ctx.mobile = c.phone || undefined
      ctx.email = c.email || undefined
    }
  }
  return ctx
}

export async function loadPromotionByCode(bizId: string, code: string): Promise<PromotionLite | null> {
  const p = await prisma.promotion.findFirst({
    where: { businessId: bizId, code: code.trim().toUpperCase() },
    include: { rules: true },
  })
  return (p as unknown as PromotionLite) || null
}

// Live, non-code (auto/public) promotions for automatic best-offer evaluation.
export async function loadLivePromotions(bizId: string): Promise<PromotionLite[]> {
  const rows = await prisma.promotion.findMany({
    where: { businessId: bizId, status: "ACTIVE", enabled: true },
    include: { rules: true },
  })
  return rows as unknown as PromotionLite[]
}

// Per-customer usage count for a promotion (enforces maxUsesPerCustomer).
export async function customerRedemptionCount(promotionId: string, customerId: string | null | undefined): Promise<number> {
  if (!customerId) return 0
  return prisma.promotionRedemption.count({ where: { promotionId, customerId, status: { in: ["APPLIED", "PENDING_AUDIT", "FINALIZED"] } } })
}
