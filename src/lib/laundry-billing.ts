// ============================================================================
// Laundry Billing Resolver — the single source of truth for pricing.
//
// Given the Pricing Engine rules + an order context (customer type, store,
// weekend, express/pickup/delivery) + line items (service, garment, category,
// quantity/weight), it resolves the best-matching rule per line and computes
// the bill. No price is ever hardcoded in New Order / POS / Website / Invoice —
// they all call this engine (directly or via /api/laundry/billing/quote).
//
// Rule matching (Laundry OS model): pricing exists only between Service +
// Garment. Each Service + Garment has exactly ONE pricing record, and the
// billing type (PER_PIECE | PER_KG) is a field on it. Resolution loads that one
// record — nothing more. Categories only organise garments; they never price.
// There is no scope scoring, no priority, no tie-breaking.
// ============================================================================
import { billingStrategyFor } from "@/lib/laundry-billing-strategies"

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
  freeDeliveryThreshold?: number | null
  urgentDeliveryCharge?: number | null
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
  // The single total order weight measured at Store Audit. Drives PER_KG billing
  // (one weight × rate for the whole order). 0/undefined before audit = estimate.
  totalWeightKg?: number
  weekend?: boolean
  express?: boolean
  pickup?: boolean
  delivery?: boolean
  urgent?: boolean
  // Config-driven Charges & Rules (resolved by the caller from
  // LaundryOperationalConfig + order type). See resolveMinOrderValue().
  minOrderValue?: number
  expressChargeType?: "FIXED" | "PERCENT"
  expressChargeValue?: number
}

export interface BillingLineResult extends BillingLineInput {
  matchedRuleId: string | null
  pricingType: string | null
  unitPrice: number
  baseAmount: number
  gstPercent: number
  gstAmount: number
  lineTotal: number
  // True when this line is priced PER_KG but no measured weight (> 0) is present.
  // Such a line cannot be finalised (it would bill ₹0) — the pricing/audit gate
  // must collect a measured weight first (WEIGHT_REQUIRED).
  weightRequired?: boolean
  note?: string
}

export interface BillingQuote {
  lines: BillingLineResult[]
  subtotal: number
  gstTotal: number
  minOrderAdjustment: number
  pickupCharge: number
  deliveryCharge: number
  expressCharge: number
  urgentCharge: number
  grandTotal: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Laundry OS prices garments per service: there is exactly ONE pricing record
// per Service + Garment. Load that record — nothing else. The billing type
// (PER_PIECE | PER_KG) is a field on it (see computeLine): PER_KG bills
// Weight × Rate, PER_PIECE bills Quantity × Rate.
//
// This is deliberately simple and deterministic. Categories only organise
// garments; they never price. There is NO category/store/customer scoping, NO
// match scoring, NO priority, and NO tie-breaking — that machinery did not fit
// the laundry business model and made pricing non-deterministic.
export function resolveLineRule(rules: PricingRule[], line: BillingLineInput): PricingRule | null {
  if (line.garmentId == null) return null
  return rules.find((r) => r.isActive && r.serviceId === line.serviceId && r.garmentId === line.garmentId) ?? null
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

  // NOTE: minCharge is a MINIMUM ORDER charge, applied once at the order level
  // (see computeQuote) — NOT a per-line unit-price replacement. Applying it here
  // would make a garment's displayed price jump to the minimum (the ₹200 Blanket
  // bug). The line keeps its real Service+Garment base price.
  base = r2(base)
  const gstAmount = r2(base * (rule.gstPercent || 0) / 100)
  // A PER_KG line with no measured weight cannot be priced — flag it so the
  // pricing/audit gate blocks finalisation instead of silently billing ₹0.
  const weightRequired = rule.pricingType === "PER_KG" && weight <= 0
  return {
    ...line,
    matchedRuleId: rule.id,
    pricingType: rule.pricingType,
    unitPrice,
    baseAmount: base,
    gstPercent: rule.gstPercent || 0,
    gstAmount,
    lineTotal: r2(base + gstAmount),
    weightRequired,
  }
}

// Order-level guard: which lines are PER_KG with no measured weight. Backend
// gates (payment / processing start) use this to enforce WEIGHT_REQUIRED.
export function linesNeedingWeight(quote: BillingQuote): BillingLineResult[] {
  return quote.lines.filter((l) => l.weightRequired)
}

// ── Evaluation trace (for the Pricing Simulator / Resolution Visualizer) ─────
// Additive: reuses the exact same matching predicate as resolveLineRule, but
// returns every candidate with the reason it applied or was skipped, ranked in
// the order the resolver considers them. The billing logic itself is unchanged.
export interface RuleEvaluation {
  ruleId: string
  ruleName: string | null
  applies: boolean
  score: number
  priority: number
  isWinner: boolean
  reasons: string[]
}

export interface LineEvaluation {
  winnerId: string | null
  evaluations: RuleEvaluation[]
}

export function evaluateLine(rules: PricingRule[], line: BillingLineInput): LineEvaluation {
  // Simple, deterministic: a rule applies to a line only when it is active and
  // its Service + Garment match. That single rule is the winner.
  const winner = resolveLineRule(rules, line)
  const evals: RuleEvaluation[] = rules.map((rule) => {
    const applies = !!rule.isActive && rule.serviceId === line.serviceId && rule.garmentId != null && rule.garmentId === line.garmentId
    return {
      ruleId: rule.id,
      ruleName: (rule as PricingRule & { name?: string | null }).name ?? null,
      applies,
      score: applies ? 1 : 0,
      priority: rule.priority,
      isWinner: winner?.id === rule.id,
      reasons: [!rule.isActive ? "Inactive — excluded" : applies ? "Matches this Service + Garment" : "Different Service / Garment"],
    }
  })
  evals.sort((a, b) => (a.applies === b.applies ? 0 : a.applies ? -1 : 1))
  return { winnerId: winner?.id ?? null, evaluations: evals }
}

export function computeQuote(rules: PricingRule[], items: BillingLineInput[], ctx: BillingContext): BillingQuote {
  // Resolve each garment line to its single Service+Garment rule + rate.
  const resolved = items.map((line) => {
    const rule = resolveLineRule(rules, line)
    const unitPrice = rule ? (ctx.weekend && rule.weekendPrice != null ? rule.weekendPrice : rule.price) : 0
    return { line, rule, pricingType: (rule?.pricingType ?? null) as string | null, unitPrice, gstPercent: rule?.gstPercent ?? 0, quantity: line.quantity != null && line.quantity > 0 ? line.quantity : 1 }
  })

  // Delegate amount computation to the billing STRATEGY for each type (grouped
  // so PER_KG can bill the whole order once by total weight). The Order/Workflow
  // engines never see this — they just read the priced lines.
  const lines: BillingLineResult[] = new Array(items.length)
  const groups = new Map<string, number[]>()
  resolved.forEach((r, i) => {
    if (!r.rule) { lines[i] = { ...r.line, matchedRuleId: null, pricingType: null, unitPrice: 0, baseAmount: 0, gstPercent: 0, gstAmount: 0, lineTotal: 0, note: "No pricing rule" }; return }
    const key = r.pricingType || "PER_PIECE"
    const arr = groups.get(key) || []; arr.push(i); groups.set(key, arr)
  })
  for (const [key, idxs] of groups) {
    const strat = billingStrategyFor(key)
    const priced = strat.price(idxs.map((i) => ({ pricingType: key, quantity: resolved[i].quantity, unitPrice: resolved[i].unitPrice, gstPercent: resolved[i].gstPercent })), { totalWeightKg: ctx.totalWeightKg ?? 0 })
    idxs.forEach((i, j) => {
      const r = resolved[i]; const p = priced[j]
      lines[i] = { ...r.line, matchedRuleId: r.rule!.id, pricingType: r.pricingType, unitPrice: r.unitPrice, baseAmount: p.lineAmount, gstPercent: r.gstPercent, gstAmount: p.gstAmount, lineTotal: p.total, weightRequired: p.weightRequired }
    })
  }

  const subtotal = r2(lines.reduce((s, l) => s + l.baseAmount, 0))
  const gstTotal = r2(lines.reduce((s, l) => s + l.gstAmount, 0))

  // Order-level charges are now driven by the two Charges & Rules config cards,
  // NOT by generic pricing rules. The caller resolves the applicable minimum
  // (by order type) and the express charge into ctx. This keeps the single
  // Billing Resolver authoritative while removing per-rule charge stacking.

  // Minimum Order Adjustment: a MINIMUM BILL VALUE for the order type — if the
  // base subtotal is below it, top up once (never folded into a unit price).
  const minOrderValue = ctx.minOrderValue ?? 0
  const minOrderAdjustment = subtotal > 0 && minOrderValue > subtotal ? r2(minOrderValue - subtotal) : 0

  // Express charge: fixed amount or a percentage of the base subtotal.
  const expressCharge = ctx.express && (ctx.expressChargeValue ?? 0) > 0
    ? r2(ctx.expressChargeType === "PERCENT" ? subtotal * (ctx.expressChargeValue as number) / 100 : (ctx.expressChargeValue as number))
    : 0

  const grandTotal = r2(subtotal + minOrderAdjustment + expressCharge + gstTotal)
  return { lines, subtotal, gstTotal, minOrderAdjustment, pickupCharge: 0, deliveryCharge: 0, expressCharge, urgentCharge: 0, grandTotal }
}
