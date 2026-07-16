// ============================================================================
// Laundry Billing — Strategy Pattern.
//
// Billing is a pluggable concern. Each billing method is a Strategy the Billing
// Engine delegates to; adding a method = register a Strategy here, and NEITHER
// the Order Engine NOR the Workflow Engine changes. The platform ships exactly
// two strategies:
//
//   • PER_PIECE — each garment bills quantity × rate. Priced at booking.
//   • PER_KG    — the WHOLE order's PER_KG portion bills ONCE using the single
//                 total order weight measured at Store Audit × rate. Garment
//                 quantities are kept for inventory / tracking / barcode / QC /
//                 delivery — they never drive the KG price.
//
// Billing and processing are separate: quantities flow through the workflow;
// the KG bill is a single weight × rate computed at audit.
// ============================================================================

const r2 = (n: number) => Math.round((n || 0) * 100) / 100

// A line as the Billing Engine sees it: the resolved rate + the quantity (kept
// for inventory) + GST. Weight is NOT a per-line concept — it is one order value.
export interface StrategyLine {
  pricingType: string
  quantity: number
  unitPrice: number // resolved rate: ₹/piece (PER_PIECE) or ₹/KG (PER_KG)
  gstPercent: number
}

export interface StrategyContext {
  // The single total order weight, measured once at Store Audit. 0 before then
  // (a PER_KG order is an estimate — ₹0 — until it is weighed).
  totalWeightKg: number
}

export interface StrategyLineResult {
  lineAmount: number
  gstAmount: number
  total: number
  weightRequired?: boolean // PER_KG with no measured order weight yet
}

export interface BillingStrategy {
  readonly key: string
  // Prices the GROUP of lines this strategy owns; returns results aligned 1:1.
  price(lines: StrategyLine[], ctx: StrategyContext): StrategyLineResult[]
}

// ── PER_PIECE ────────────────────────────────────────────────────────────────
export const perPieceStrategy: BillingStrategy = {
  key: "PER_PIECE",
  price(lines) {
    return lines.map((l) => {
      const amt = r2((l.quantity || 0) * l.unitPrice)
      const gst = r2((amt * (l.gstPercent || 0)) / 100)
      return { lineAmount: amt, gstAmount: gst, total: r2(amt + gst) }
    })
  },
}

// ── PER_KG (single total order weight) ───────────────────────────────────────
// The order's PER_KG portion bills ONCE = totalWeightKg × rate. The single bill
// is allocated across the garment lines proportionally to quantity purely so the
// invoice can show a per-line figure; the amounts sum EXACTLY to weight × rate
// (last line absorbs rounding). No per-garment weight exists.
export const perKgStrategy: BillingStrategy = {
  key: "PER_KG",
  price(lines, ctx) {
    const rate = lines.find((l) => l.unitPrice > 0)?.unitPrice ?? lines[0]?.unitPrice ?? 0
    const weight = ctx.totalWeightKg || 0
    const noWeight = weight <= 0
    const grand = r2(weight * rate)
    const totalQty = lines.reduce((s, l) => s + (l.quantity || 0), 0) || 1
    let rest = grand
    return lines.map((l, i) => {
      const last = i === lines.length - 1
      const amt = last ? rest : r2((grand * (l.quantity || 0)) / totalQty)
      rest = r2(rest - amt)
      const gst = r2((amt * (l.gstPercent || 0)) / 100)
      return { lineAmount: amt, gstAmount: gst, total: r2(amt + gst), weightRequired: noWeight }
    })
  },
}

const REGISTRY: Record<string, BillingStrategy> = {
  [perPieceStrategy.key]: perPieceStrategy,
  [perKgStrategy.key]: perKgStrategy,
}

// Resolve the strategy for a billing type. Unknown/legacy types (e.g. a covered
// SUBSCRIPTION line priced at ₹0) fall back to PER_PIECE, which with unitPrice 0
// yields ₹0 — so the Order Engine never needs to special-case them.
export function billingStrategyFor(pricingType: string | null | undefined): BillingStrategy {
  return (pricingType && REGISTRY[pricingType]) || perPieceStrategy
}

export function registeredBillingStrategies(): string[] {
  return Object.keys(REGISTRY)
}
