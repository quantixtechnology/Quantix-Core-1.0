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
  applyTo?: string // one of APPLY_TO_OPTIONS — see marketing-shared
  /** How many times THIS customer has already redeemed this coupon. */
  customerRedemptions?: number
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

/**
 * Why a coupon was refused. A machine-readable code alongside the message, so
 * a caller can branch on the cause instead of matching prose.
 */
export type IneligibleCode =
  | "DISABLED" | "NOT_STARTED" | "EXPIRED" | "USAGE_LIMIT" | "ALREADY_REDEEMED"
  | "WRONG_WORKSPACE" | "WRONG_PURCHASE_TYPE" | "MIN_ORDER" | "RULES"

export interface EligibilityResult { eligible: boolean; reason?: string; code?: IneligibleCode }

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`
const onDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

/**
 * Full eligibility for a specific cart/customer context.
 *
 * Every branch names its own cause. "This coupon is not currently active"
 * covered five different failures — expired, not yet started, paused, disabled,
 * exhausted — and a customer at a counter cannot act on that, nor can the
 * operator explain it. Each now says the one thing that is actually wrong.
 */
export function checkEligibility(p: PromotionLite, ctx: PromoContext, now: Date = new Date()): EligibilityResult {
  // Order matters: state of the coupon itself, then the fit with this cart.
  if (!p.enabled || p.status === "PAUSED" || p.status === "CANCELLED") {
    return { eligible: false, code: "DISABLED", reason: "This coupon has been disabled." }
  }
  if (p.startAt && now < new Date(p.startAt)) {
    return { eligible: false, code: "NOT_STARTED", reason: `This coupon starts on ${onDate(p.startAt)}.` }
  }
  if (p.status === "EXPIRED" || (p.endAt && now > new Date(p.endAt))) {
    return { eligible: false, code: "EXPIRED", reason: p.endAt ? `This coupon expired on ${onDate(p.endAt)}.` : "This coupon has expired." }
  }
  if (p.status !== "ACTIVE" && p.status !== "SCHEDULED") {
    return { eligible: false, code: "DISABLED", reason: "This coupon is not available." }
  }
  if (p.maxUses != null && p.usedCount >= p.maxUses) {
    return { eligible: false, code: "USAGE_LIMIT", reason: "This coupon has reached its usage limit." }
  }
  // Per-customer cap — the customer has had their turn, which is a different
  // thing from the coupon being exhausted globally.
  if (p.maxUsesPerCustomer != null && (ctx.customerRedemptions ?? 0) >= p.maxUsesPerCustomer) {
    return { eligible: false, code: "ALREADY_REDEEMED", reason: "You have already redeemed this coupon." }
  }
  if (p.workspaceType && ctx.workspaceType && p.workspaceType !== ctx.workspaceType) {
    return { eligible: false, code: "WRONG_WORKSPACE", reason: "This coupon is not valid here." }
  }
  const applyTo = parseApplyTo(p.applyTo)
  if (ctx.applyTo && !applyTo.includes(ctx.applyTo)) {
    return { eligible: false, code: "WRONG_PURCHASE_TYPE", reason: purchaseTypeReason(applyTo) }
  }
  if (p.minOrderValue != null && (ctx.orderValue ?? 0) < p.minOrderValue) {
    return { eligible: false, code: "MIN_ORDER", reason: `Minimum order of ${inr(p.minOrderValue)} required.` }
  }
  if (!rulesPass(p.rules, ctx)) {
    return { eligible: false, code: "RULES", reason: "You are not eligible for this coupon." }
  }
  return { eligible: true }
}

/** Name what the coupon IS for, rather than only what this purchase is not. */
function purchaseTypeReason(applyTo: string[]): string {
  const NAMES: Record<string, string> = {
    ORDER: "normal orders", FIRST_ORDER: "a first order",
    SUBSCRIPTION_PURCHASE: "subscription purchase", SUBSCRIPTION_RENEWAL: "subscription renewal",
    SUBSCRIPTION_UPGRADE: "subscription upgrade", ANNUAL_PLAN: "annual plans",
    REFERRAL_REWARD: "referral rewards", BIRTHDAY: "birthday rewards",
    LOYALTY_REWARD: "loyalty rewards", FESTIVAL_CAMPAIGN: "festival campaigns",
    RECOVERY: "recovery offers",
  }
  const names = applyTo.map((k) => NAMES[k] ?? k.toLowerCase().replace(/_/g, " "))
  if (names.length === 0) return "This coupon is not valid for this purchase."
  if (names.length === 1) return `Valid only for ${names[0]}.`
  return `Valid only for ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`
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
