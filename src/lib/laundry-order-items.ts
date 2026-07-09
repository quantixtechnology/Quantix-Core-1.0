// Per-piece garment identity. A billing line "2 × Shirt — Wash & Iron" must
// become TWO individually traceable garments (Shirt 1, Shirt 2), each with its
// own ITM code + barcode + processing route/history. PER_PIECE lines with
// quantity > 1 are exploded into per-piece rows whose amounts sum EXACTLY to
// the original line (last piece absorbs rounding). PER_KG lines stay whole —
// a 4kg wash load is one operational unit.

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
    const splittable = line.pricingType !== "PER_KG" && qty > 1 && Math.abs(qty - line.quantity) < 1e-9
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
