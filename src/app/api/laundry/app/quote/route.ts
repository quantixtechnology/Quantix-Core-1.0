// POST /api/laundry/app/quote — estimated charges + subscription coverage
// preview for the review step (Phases 5/7). Consumes the frozen billing engine
// and the frozen consumption engine (no pricing/subscription logic here).
// Body: { items:[{serviceId, garmentId, quantity, weightKg?}], express? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"
import { explodePieces } from "@/lib/laundry-order-items"
import { computeCoverage, type SubForCoverage, type CoverLine, type AllowanceMode } from "@/lib/laundry-subscription-consumption"
import { coverageUnitOf } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request) {
  const sess = await resolveSession(request)
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  const items = Array.isArray(b.items) ? b.items : []
  if (items.length === 0) return NextResponse.json({ success: true, data: { grandTotal: 0, coveredAmount: 0, extraAmount: 0, lines: [] } })
  const biz = await resolveLaundryBusiness(sess.businessId)
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const billing = await resolveOrderBilling(biz.id, { customerType: "WALK_IN", express: !!b.express }, items)
  const grandTotal = r2(billing.quote?.grandTotal ?? 0)

  const subs = await prisma.customerSubscription.findMany({
    where: { customerId: sess.customerId, status: { in: ["ACTIVE", "GRACE"] } }, orderBy: { createdAt: "asc" },
    include: { plan: { select: { coverageRules: { select: { serviceId: true, garmentId: true, allowanceMode: true } } } } },
  })
  const priced = explodePieces(billing.lines)
  const lines: CoverLine[] = priced.map((l, i) => ({ itemId: `q-${i}`, serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity || 1, weightKg: l.weightKg || 0, unitPrice: l.unitPrice || 0, lineAmount: l.lineAmount || 0 }))
  let coveredAmount = 0
  if (subs.length) {
    const subInputs: SubForCoverage[] = subs.map((s) => ({ id: s.id, remainingKg: s.remainingKg, remainingPieces: s.remainingPieces, coverageUnit: coverageUnitOf(s), rules: s.plan.coverageRules.map((r) => ({ serviceId: r.serviceId, garmentId: r.garmentId, mode: (r.allowanceMode === "PER_KG" ? "PER_KG" : "PER_PIECE") as AllowanceMode })) }))
    coveredAmount = computeCoverage(subInputs, lines).coveredAmount
  }
  return NextResponse.json({ success: true, data: { grandTotal, coveredAmount: r2(coveredAmount), extraAmount: r2(grandTotal - coveredAmount), lineCount: priced.length } })
}
