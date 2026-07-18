// Garment Code utilities — the immutable enterprise key for garments. Codes are
// unique per business, auto-generated when not supplied, and NEVER change once
// set (the Pricing Matrix references garment identity, so names can change
// freely without breaking pricing or history).
import { prisma } from "@/lib/prisma"

// Next sequential GAR##### code not already present in `taken`.
export function nextGarmentCode(taken: Set<string>): string {
  let max = 0
  for (const c of taken) {
    const m = /^GAR(\d+)$/i.exec(c.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  let n = max + 1
  let code = `GAR${String(n).padStart(5, "0")}`
  while (taken.has(code)) { n++; code = `GAR${String(n).padStart(5, "0")}` }
  return code
}

// Backfill a code for every code-less garment in a business (idempotent, cheap —
// only touches rows with a null/empty code). Safe to call on every list/export.
export async function ensureGarmentCodes(businessId: string): Promise<void> {
  const garments = await prisma.laundryGarment.findMany({ where: { businessId }, select: { id: true, code: true } })
  const taken = new Set<string>()
  const missing: string[] = []
  for (const g of garments) { const c = (g.code || "").trim(); if (c) taken.add(c); else missing.push(g.id) }
  if (!missing.length) return
  for (const id of missing) {
    const code = nextGarmentCode(taken)
    taken.add(code)
    try { await prisma.laundryGarment.update({ where: { id }, data: { code } }) } catch { /* unique race — next pass fixes it */ }
  }
}

// Reserve a NEW unique code for a business (used when creating a garment without
// an explicit code). Reads the current set and returns the next free code.
export async function reserveGarmentCode(businessId: string): Promise<string> {
  const rows = await prisma.laundryGarment.findMany({ where: { businessId }, select: { code: true } })
  const taken = new Set<string>()
  for (const r of rows) { const c = (r.code || "").trim(); if (c) taken.add(c) }
  return nextGarmentCode(taken)
}

// Which garments are referenced where — for export flags and delete-vs-archive.
export async function garmentUsage(garmentIds: string[]): Promise<{ pricing: Set<string>; orders: Set<string>; subs: Set<string> }> {
  const pricing = new Set<string>(), orders = new Set<string>(), subs = new Set<string>()
  if (!garmentIds.length) return { pricing, orders, subs }
  const [pr, or, su] = await Promise.all([
    prisma.laundryPricingRule.findMany({ where: { garmentId: { in: garmentIds } }, select: { garmentId: true }, distinct: ["garmentId"] }),
    prisma.laundryOrderItem.findMany({ where: { garmentId: { in: garmentIds } }, select: { garmentId: true }, distinct: ["garmentId"] }),
    prisma.subscriptionPlanCoverage.findMany({ where: { garmentId: { in: garmentIds } }, select: { garmentId: true }, distinct: ["garmentId"] }),
  ])
  for (const r of pr) if (r.garmentId) pricing.add(r.garmentId)
  for (const r of or) if (r.garmentId) orders.add(r.garmentId)
  for (const r of su) if (r.garmentId) subs.add(r.garmentId)
  return { pricing, orders, subs }
}
