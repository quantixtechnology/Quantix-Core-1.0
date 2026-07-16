// Per-garment identity. A billing line "4 × Shirt — Wash" must become FOUR
// individually traceable garments (Shirt 1..4), each with its own ITM code +
// barcode + processing route/history. EVERY line with an integer quantity > 1
// is exploded into per-unit rows whose amounts sum EXACTLY to the original line
// (last unit absorbs rounding) — INCLUDING PER_KG. PER_KG still bills the whole
// order by ONE total weight captured at Store Audit, allocated across the rows
// by quantity, so the per-garment split never changes the total billed amount;
// it only gives each physical garment its own barcode + lifecycle.

const r2 = (n: number) => Math.round(n * 100) / 100

export interface SplittableLine {
  pricingType: string
  quantity: number
  weightKg?: number
  unitPrice: number
  lineAmount: number
  gstPercent: number
  gstAmount: number
  discount?: number
  total: number
}

export function explodePieces<L extends SplittableLine>(lines: L[]): L[] {
  const out: L[] = []
  for (const line of lines) {
    const qty = Math.round(line.quantity)
    // Split by piece count for garment identity regardless of billing type.
    // PER_KG is billed once by total order weight at Store Audit (allocated
    // across these rows by quantity), so splitting does not change the bill.
    const splittable = qty > 1 && Math.abs(qty - line.quantity) < 1e-9
    if (!splittable) { out.push(line); continue }

    let restLine = r2(line.lineAmount)
    let restGst = r2(line.gstAmount)
    let restTotal = r2(line.total)
    let restDisc = r2(line.discount || 0)
    for (let i = 0; i < qty; i++) {
      const last = i === qty - 1
      const lineAmount = last ? restLine : r2(line.lineAmount / qty)
      const gstAmount = last ? restGst : r2(line.gstAmount / qty)
      const total = last ? restTotal : r2(line.total / qty)
      const discount = last ? restDisc : r2((line.discount || 0) / qty)
      restLine = r2(restLine - lineAmount)
      restGst = r2(restGst - gstAmount)
      restTotal = r2(restTotal - total)
      restDisc = r2(restDisc - discount)
      out.push({ ...line, quantity: 1, weightKg: 0, lineAmount, gstAmount, total, discount })
    }
  }
  return out
}
