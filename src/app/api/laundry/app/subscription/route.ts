// GET /api/laundry/app/subscription — the customer's active subscription with
// remaining KG/Pieces, renewal, expiry, eligible services, and the allowance
// ledger / consumption history (Phase 4). Consumes the frozen Subscription
// Engine — builds no subscription logic.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { subscriptionLedger } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const subs = await prisma.customerSubscription.findMany({
    where: { customerId: sess.customerId, status: { in: ["ACTIVE", "GRACE"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true, autoRenew: true, coverageRules: { select: { serviceId: true, garmentId: true, allowanceMode: true } } } } },
  })
  if (subs.length === 0) return NextResponse.json({ success: true, data: { active: null, history: [] } })

  const primary = subs[0]
  const serviceIds = [...new Set(primary.plan.coverageRules.map((r) => r.serviceId))]
  const services = serviceIds.length ? await prisma.laundryService.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }) : []
  const svcName = new Map(services.map((s) => [s.id, s.name]))
  const { entries } = await subscriptionLedger(primary.id)

  return NextResponse.json({ success: true, data: {
    active: {
      id: primary.id, planName: primary.plan.name, status: primary.status, autoRenew: primary.plan.autoRenew,
      allowanceKg: primary.allowanceKg, remainingKg: primary.remainingKg, usedKg: primary.usedKg,
      allowancePieces: primary.allowancePieces, remainingPieces: primary.remainingPieces, usedPieces: primary.usedPieces,
      cycleStart: primary.currentPeriodStart, expiry: primary.currentPeriodEnd, renewalDate: primary.nextBillingDate, graceEndsAt: primary.graceEndsAt,
      eligibleServices: [...new Set(primary.plan.coverageRules.map((r) => svcName.get(r.serviceId)).filter(Boolean))],
    },
    // Consumption history / ledger (append-only).
    ledger: entries.map((e) => ({ at: e.createdAt, type: e.entryType, unit: e.unit, delta: e.delta, balanceAfter: e.balanceAfter, note: e.note })),
    others: subs.slice(1).map((s) => ({ id: s.id, planName: s.plan.name, remainingKg: s.remainingKg, remainingPieces: s.remainingPieces, expiry: s.currentPeriodEnd })),
  } })
}
