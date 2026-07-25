// POST /api/laundry/subscriptions/preview
// LIVE eligibility preview for the New Order screen (Parts 2/4). Prices the
// draft lines with the FROZEN billing engine, then runs the pure consumption
// engine WITHOUT consuming anything, returning a per-line status
// (COVERED | PARTIAL | REGULAR) and the split totals (covered / extra).
//
// Body: { businessId, customerId, storeId?, orderType?, express?, items:[{serviceId, garmentId, quantity, weightKg?}] }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrderBilling, orderTypeToCustomerType } from "@/lib/laundry-billing-server"
import { explodePieces } from "@/lib/laundry-order-items"
import { computeCoverage, type SubForCoverage, type CoverLine } from "@/lib/laundry-subscription-consumption"
import { subscriptionCoverageRules } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const { businessId, customerId, storeId, orderType, express, items } = b
    if (!businessId || !Array.isArray(items) || items.length === 0) return NextResponse.json({ success: true, data: { covered: false, lines: [], coveredAmount: 0, extraAmount: 0 } })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: { covered: false, lines: [], coveredAmount: 0, extraAmount: 0 } })
    const platformId = biz.platformBusinessId || businessId

    // No customer or no active subscription → nothing covered (walk-in preview).
    const subs = customerId ? await prisma.customerSubscription.findMany({
      where: { businessId: platformId, customerId, status: { in: ["ACTIVE", "GRACE"] } },
      orderBy: { createdAt: "asc" },
    }) : []

    // Price the draft lines with the frozen engine (regular price).
    const customerType = orderTypeToCustomerType(orderType || "WALK_IN")
    const billing = await resolveOrderBilling(biz.id, { storeId: storeId || undefined, customerType, express: !!express }, items)
    const priced = explodePieces(billing.lines)
    const lineInputs: CoverLine[] = priced.map((l, i) => ({ itemId: `preview-${i}`, serviceId: l.serviceId, garmentId: l.garmentId, quantity: l.quantity || 1, weightKg: l.weightKg || 0, unitPrice: l.unitPrice || 0, lineAmount: l.lineAmount || 0 }))

    if (subs.length === 0) {
      return NextResponse.json({ success: true, data: { covered: false, coveredAmount: 0, extraAmount: r2(lineInputs.reduce((n, l) => n + l.lineAmount, 0)), lines: lineInputs.map((l) => ({ serviceId: l.serviceId, garmentId: l.garmentId, lineAmount: l.lineAmount, coveredAmount: 0, extraAmount: l.lineAmount, status: "REGULAR" })) } })
    }

    // Eligibility from the Pricing Matrix (single source), same as apply.
    const matrixRules = await subscriptionCoverageRules(biz.id)
    const subInputs: SubForCoverage[] = subs.map((s) => ({ id: s.id, remainingKg: s.remainingKg, remainingPieces: s.remainingPieces, rules: matrixRules }))
    const result = computeCoverage(subInputs, lineInputs)

    const lines = result.lines.map((lc, i) => ({
      serviceId: lineInputs[i].serviceId, garmentId: lineInputs[i].garmentId, lineAmount: lineInputs[i].lineAmount,
      coveredAmount: lc.coveredAmount, extraAmount: lc.extraAmount,
      status: lc.coveredAmount <= 0 ? "REGULAR" : lc.extraAmount > 0 ? "PARTIAL" : "COVERED",
    }))
    return NextResponse.json({ success: true, data: {
      covered: result.coveredAmount > 0, coveredAmount: result.coveredAmount, extraAmount: result.extraAmount,
      grandTotal: r2(billing.quote?.grandTotal ?? lineInputs.reduce((n, l) => n + l.lineAmount, 0)), lines,
    } })
  } catch (e) {
    console.error("[laundry-subscriptions-preview] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
