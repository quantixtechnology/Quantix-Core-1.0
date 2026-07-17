// ============================================================================
// QUANTIX MARKETING ENGINE — Phase 1 evaluation core (Vouchers/Coupons).
//
// Pure, data-driven decision layer. Given a promotion (+ its rules) and a
// context (cart value, customer facts, applyTo), it decides eligibility and the
// discount amount. NO hardcoded promo logic — rules are rows. The Marketing
// layer NEVER prices or places an order; the existing Pricing/Order engines
// consume the decision. Laundry is audit-later, so its coupons are "pending"
// (discount computed but 0 at booking) until the invoice finalizes them.
// See docs/QUANTIX_MARKETING_ENGINE_STANDARD.md.
// ============================================================================

export interface PromotionRuleLite { fact: string; op: string; value: string }
export interface PromotionLite {
  id: string; businessId: string; workspaceType: string | null; kind: string
  title: string; description: string | null; code: string | null
  discountType: string; discountValue: number; maxDiscount: number | null; minOrderValue: number | null
  status: string; enabled: boolean; startAt: Date | null; endAt: Date | null
  maxUses: number | null; maxUsesPerCustomer: number | null; usedCount: number
  applyTo: string; rules?: PromotionRuleLite[]
}

// Facts the rule engine can compare against (Phase 1 subset; extend additively).
export interface PromoContext {
  workspaceType?: string | null
  applyTo?: string // ORDER | SUBSCRIPTION_PURCHASE | SUBSCRIPTION_RENEWAL
  orderValue?: number
  firstOrder?: boolean
  customerTier?: string
  customerTags?: string[]
  mobile?: string
  email?: string
  subscriptionActive?: boolean
  lifetimeOrders?: number
  lifetimeSpend?: number
}

const parseJSON = <T,>(raw: string | null | undefined, fallback: T): T => {
  try { const v = JSON.parse(raw ?? ""); return v as T } catch { return fallback }
}

export const parseApplyTo = (raw: string | null | undefined): string[] => {
  const a = parseJSON<unknown>(raw, ["ORDER"])
  return Array.isArray(a) ? a.map(String) : ["ORDER"]
}

// Resolve a single fact from the context.
function factValue(fact: string, ctx: PromoContext): unknown {
  switch (fact) {
    case "orderValue": return ctx.orderValue ?? 0
    case "firstOrder": return !!ctx.firstOrder
    case "customerTier": return ctx.customerTier ?? "BRONZE"
    case "customerTags": return ctx.customerTags ?? []
    case "mobile": return ctx.mobile ?? ""
    case "email": return ctx.email ?? ""
    case "subscriptionActive": return !!ctx.subscriptionActive
    case "lifetimeOrders": return ctx.lifetimeOrders ?? 0
    case "lifetimeSpend": return ctx.lifetimeSpend ?? 0
    default: return undefined
  }
}

// Evaluate one rule (fact op value). `value` is JSON-encoded.
function evalRule(rule: PromotionRuleLite, ctx: PromoContext): boolean {
  const left = factValue(rule.fact, ctx)
  const right = parseJSON<unknown>(rule.value, rule.value)
  const num = (x: unknown) => (typeof x === "number" ? x : Number(x))
  switch (rule.op) {
    case "eq": return String(left) === String(right)
    case "neq": return String(left) !== String(right)
    case "gt": return num(left) > num(right)
    case "gte": return num(left) >= num(right)
    case "lt": return num(left) < num(right)
    case "lte": return num(left) <= num(right)
    case "in": return Array.isArray(right) && right.map(String).includes(String(left))
    case "contains": return Array.isArray(left) && left.map(String).includes(String(right))
    case "isTrue": return left === true
    case "isFalse": return left === false
    default: return false
  }
}

// ALL rules must pass (AND). Empty rules = always eligible.
export function rulesPass(rules: PromotionRuleLite[] | undefined, ctx: PromoContext): boolean {
  if (!rules || rules.length === 0) return true
  return rules.every((r) => evalRule(r, ctx))
}

// Is the promotion live right now (status + enabled + window + not exhausted)?
export function isLive(p: PromotionLite, now: Date = new Date()): boolean {
  if (!p.enabled) return false
  if (p.status !== "ACTIVE" && p.status !== "SCHEDULED") return false
  if (p.startAt && now < new Date(p.startAt)) return false
  if (p.endAt && now > new Date(p.endAt)) return false
  if (p.maxUses != null && p.usedCount >= p.maxUses) return false
  return true
}

export interface EligibilityResult { eligible: boolean; reason?: string }

// Full eligibility for a specific cart/customer context.
export function checkEligibility(p: PromotionLite, ctx: PromoContext, now: Date = new Date()): EligibilityResult {
  if (!isLive(p, now)) return { eligible: false, reason: "This coupon is not currently active." }
  if (p.workspaceType && ctx.workspaceType && p.workspaceType !== ctx.workspaceType) return { eligible: false, reason: "Not valid for this workspace." }
  const applyTo = parseApplyTo(p.applyTo)
  if (ctx.applyTo && !applyTo.includes(ctx.applyTo)) return { eligible: false, reason: "Not valid for this purchase type." }
  if (p.minOrderValue != null && (ctx.orderValue ?? 0) < p.minOrderValue) return { eligible: false, reason: `Minimum order value is ₹${p.minOrderValue}.` }
  if (!rulesPass(p.rules, ctx)) return { eligible: false, reason: "You are not eligible for this coupon." }
  return { eligible: true }
}

// Compute the discount amount for an order value (never negative; capped).
export function computeDiscount(p: PromotionLite, orderValue: number): number {
  const v = Math.max(0, orderValue || 0)
  let d = p.discountType === "FIXED" ? p.discountValue : (v * p.discountValue) / 100
  if (p.discountType === "PERCENT" && p.maxDiscount != null) d = Math.min(d, p.maxDiscount)
  d = Math.min(d, v) // never exceed the order value
  return Math.round(d * 100) / 100
}

// Laundry is audited later → the discount is computed for display but PENDING
// (0 applied at booking); it is finalized against the invoice after Store Audit.
export const isPendingWorkspace = (workspaceType: string | null | undefined) => workspaceType === "LAUNDRY"

export interface AppliedBenefit {
  promotionId: string; code: string | null; title: string
  discountType: string; discountValue: number
  discount: number // computed amount
  pending: boolean // true for laundry (applied after audit)
  status: string // APPLIED | PENDING_AUDIT
  message: string
}

// Build the customer-facing benefit for an eligible promotion.
export function buildBenefit(p: PromotionLite, ctx: PromoContext): AppliedBenefit {
  const discount = computeDiscount(p, ctx.orderValue ?? 0)
  const pending = isPendingWorkspace(p.workspaceType ?? ctx.workspaceType)
  return {
    promotionId: p.id, code: p.code, title: p.title,
    discountType: p.discountType, discountValue: p.discountValue,
    discount, pending,
    status: pending ? "PENDING_AUDIT" : "APPLIED",
    message: pending
      ? "Coupon applied · Discount Pending — the final discount is calculated after Store Audit."
      : `Coupon applied — you save ₹${discount}.`,
  }
}

// Pick the best (max-discount) eligible promotion from a list.
export function bestPromotion(promos: PromotionLite[], ctx: PromoContext, now: Date = new Date()): { promo: PromotionLite; benefit: AppliedBenefit } | null {
  let best: { promo: PromotionLite; benefit: AppliedBenefit } | null = null
  for (const p of promos) {
    if (!checkEligibility(p, ctx, now).eligible) continue
    const benefit = buildBenefit(p, ctx)
    if (!best || benefit.discount > best.benefit.discount) best = { promo: p, benefit }
  }
  return best
}
