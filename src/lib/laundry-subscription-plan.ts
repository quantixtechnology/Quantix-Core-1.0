// Subscription plan MASTER helpers shared by create + update (Parts 1–5).
// Maps the admin Master form fields onto SubscriptionPlan and syncs the
// per-plan service/garment eligibility + allowance-mode rows.
import { prisma } from "@/lib/prisma"

const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v))

// Additive Master fields (KG/Piece allowance, auto-renew, grace, validity).
// Returns only the keys present in the body so PUT stays a partial update.
export function planMasterFields(body: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = {}
  if (body.allowanceKg !== undefined) { const n = numOrNull(body.allowanceKg); d.allowanceKg = n == null ? null : Math.max(0, n) }
  if (body.allowancePieces !== undefined) { const n = numOrNull(body.allowancePieces); d.allowancePieces = n == null ? null : Math.max(0, Math.floor(n)) }
  if (body.autoRenew !== undefined) d.autoRenew = !!body.autoRenew
  if (body.graceDays !== undefined) d.graceDays = Math.max(0, Math.floor(Number(body.graceDays) || 0))
  if (body.validityDays !== undefined) { const n = numOrNull(body.validityDays); d.validityDays = n == null ? null : Math.max(0, Math.floor(n)) }
  return d
}

export interface CoverageInput { serviceId?: string; garmentId?: string | null; allowanceMode?: string }

// Replace a plan's coverage rules with the provided set. Validated + de-duped by
// (serviceId, garmentId). A row with no garmentId covers every garment in the
// service. allowanceMode ∈ PER_KG | PER_PIECE (defaults PER_PIECE).
export async function syncPlanCoverage(planId: string, rows: CoverageInput[] | undefined) {
  if (!Array.isArray(rows)) return
  const seen = new Set<string>()
  const clean: { planId: string; serviceId: string; garmentId: string | null; allowanceMode: string }[] = []
  for (const r of rows) {
    if (!r || !r.serviceId) continue
    const serviceId = String(r.serviceId)
    const garmentId = r.garmentId ? String(r.garmentId) : null
    const key = `${serviceId}|${garmentId || ""}`
    if (seen.has(key)) continue
    seen.add(key)
    clean.push({ planId, serviceId, garmentId, allowanceMode: r.allowanceMode === "PER_KG" ? "PER_KG" : "PER_PIECE" })
  }
  await prisma.$transaction([
    prisma.subscriptionPlanCoverage.deleteMany({ where: { planId } }),
    ...(clean.length ? [prisma.subscriptionPlanCoverage.createMany({ data: clean })] : []),
  ])
}
