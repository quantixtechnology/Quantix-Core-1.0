// ============================================================================
// Laundry Billing Resolver — the single source of truth for pricing.
//
// Given the Pricing Engine rules + an order context (customer type, store,
// weekend, express/pickup/delivery) + line items (service, garment, category,
// quantity/weight), it resolves the best-matching rule per line and computes
// the bill. No price is ever hardcoded in New Order / POS / Website / Invoice —
// they all call this engine (directly or via /api/laundry/billing/quote).
//
// Rule matching: a rule applies to a line if EVERY non-null scope on the rule
// (service, garment, category, store, customerType) equals the line/context
// value (null = "any"). The best rule = most specific (most matching scopes),
// then highest priority, then most recently effective. Effective-date window
// is respected.
// ============================================================================

export interface PricingRule {
  id: string
  serviceId: string | null
  garmentId: string | null
  categoryId: string | null
  storeId: string | null
  customerType: string | null
  pricingType: string // PER_PIECE | PER_KG | FIXED | SUBSCRIPTION | CORPORATE
  price: number
  gstPercent: number
  minCharge: number | null
  maxWeightKg: number | null
  extraWeightCharge: number | null
  weekendPrice: number | null
  expressCharge: number | null
  pickupCharge: number | null
  deliveryCharge: number | null
  effectiveFrom: string | Date | null
  effectiveTo: string | Date | null
  priority: number
  isActive: boolean
}

export interface BillingLineInput {
  serviceId?: string | null
  garmentId?: string | null
  categoryId?: string | null
  quantity?: number
  weightKg?: number
}

export interface BillingContext {
  storeId?: string | null
  customerType?: string | null
  weekend?: boolean
  express?: boolean
  pickup?: boolean
  delivery?: boolean
}

export interface BillingLineResult extends BillingLineInput {
  matchedRuleId: string | null
  pricingType: string | null
  unitPrice: number
  baseAmount: number
  gstPercent: number
  gstAmount: number
  lineTotal: number
  note?: string
}

export interface BillingQuote {
  lines: BillingLineResult[]
  subtotal: number
  gstTotal: number
  pickupCharge: number
  deliveryCharge: number
  expressCharge: number
  grandTotal: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

function inEffect(rule: PricingRule, now: Date): boolean {
  if (rule.effectiveFrom && new Date(rule.effectiveFrom) > now) return false
  if (rule.effectiveTo && new Date(rule.effectiveTo) < now) return false
  return true
}

// -1 = does not apply; otherwise the specificity score (number of matching scopes).
function matchScore(rule: PricingRule, line: BillingLineInput, ctx: BillingContext): number {
  let score = 0
  const checks: [string | null | undefined, string | null | undefined][] = [
    [rule.serviceId, line.serviceId],
    [rule.garmentId, line.garmentId],
    [rule.categoryId, line.categoryId],
    [rule.storeId, ctx.storeId],
    [rule.customerType, ctx.customerType],
  ]
  for (const [ruleVal, lineVal] of checks) {
    if (ruleVal == null) continue // "any" — applies, no specificity added
    if (ruleVal !== lineVal) return -1 // required scope mismatch → rule does not apply
    score += 1
  }
  return score
}

export function resolveLineRule(rules: PricingRule[], line: BillingLineInput, ctx: BillingContext, now = new Date()): PricingRule | null {
  let best: PricingRule | null = null
  let bestScore = -1
  for (const rule of rules) {
    if (!rule.isActive || !inEffect(rule, now)) continue
    const score = matchScore(rule, line, ctx)
    if (score < 0) continue
    if (score > bestScore || (score === bestScore && best != null && rule.priority > best.priority)) {
      best = rule
      bestScore = score
    }
  }
  return best
}

export function computeLine(rule: PricingRule | null, line: BillingLineInput, ctx: BillingContext): BillingLineResult {
  const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1
  const weight = line.weightKg != null && line.weightKg > 0 ? line.weightKg : 0

  if (!rule) {
    return { ...line, matchedRuleId: null, pricingType: null, unitPrice: 0, baseAmount: 0, gstPercent: 0, gstAmount: 0, lineTotal: 0, note: "No pricing rule" }
  }

  const unitPrice = ctx.weekend && rule.weekendPrice != null ? rule.weekendPrice : rule.price
  let base = 0
  switch (rule.pricingType) {
    case "PER_KG": {
      base = unitPrice * weight
      if (rule.maxWeightKg != null && rule.extraWeightCharge != null && weight > rule.maxWeightKg) {
        base = unitPrice * rule.maxWeightKg + (weight - rule.maxWeightKg) * rule.extraWeightCharge
      }
      break
    }
    case "SUBSCRIPTION": {
      // Covered by the subscription; only extra weight beyond the included cap bills.
      base = 0
      if (rule.maxWeightKg != null && rule.extraWeightCharge != null && weight > rule.maxWeightKg) {
        base = (weight - rule.maxWeightKg) * rule.extraWeightCharge
      }
      break
    }
    case "FIXED":
    case "CORPORATE":
    case "PER_PIECE":
    default:
      base = unitPrice * qty
      break
  }

  if (rule.minCharge != null && base < rule.minCharge) base = rule.minCharge
  base = r2(base)
  const gstAmount = r2(base * (rule.gstPercent || 0) / 100)
  return {
    ...line,
    matchedRuleId: rule.id,
    pricingType: rule.pricingType,
    unitPrice,
    baseAmount: base,
    gstPercent: rule.gstPercent || 0,
    gstAmount,
    lineTotal: r2(base + gstAmount),
  }
}

export function computeQuote(rules: PricingRule[], items: BillingLineInput[], ctx: BillingContext, now = new Date()): BillingQuote {
  const matchedRules: PricingRule[] = []
  const lines = items.map((line) => {
    const rule = resolveLineRule(rules, line, ctx, now)
    if (rule) matchedRules.push(rule)
    return computeLine(rule, line, ctx)
  })

  const subtotal = r2(lines.reduce((s, l) => s + l.baseAmount, 0))
  const gstTotal = r2(lines.reduce((s, l) => s + l.gstAmount, 0))

  // Order-level charges: taken (once) as the max charge across matched rules,
  // applied only when the context requests them.
  const maxOf = (pick: (r: PricingRule) => number | null) =>
    matchedRules.reduce((m, r) => Math.max(m, pick(r) ?? 0), 0)
  const expressCharge = ctx.express ? r2(maxOf((r) => r.expressCharge)) : 0
  const pickupCharge = ctx.pickup ? r2(maxOf((r) => r.pickupCharge)) : 0
  const deliveryCharge = ctx.delivery ? r2(maxOf((r) => r.deliveryCharge)) : 0

  const grandTotal = r2(subtotal + gstTotal + expressCharge + pickupCharge + deliveryCharge)
  return { lines, subtotal, gstTotal, pickupCharge, deliveryCharge, expressCharge, grandTotal }
}
