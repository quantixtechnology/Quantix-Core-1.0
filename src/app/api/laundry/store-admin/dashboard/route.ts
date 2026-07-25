// GET /api/laundry/store-admin/dashboard — the Store Admin operational summary.
// EVERY count is scoped to the session's businessId + storeId (server-enforced
// Store isolation). No client filter is trusted. Reads only — no workflow change.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireStoreAdmin, resolveStoreScope } from "@/lib/laundry-store-admin-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const g = await requireStoreAdmin(request)
  if (!g.ok) return g.res
  const eff = await resolveStoreScope(g.session, request)
  if (!eff) return NextResponse.json({ error: "Select a store" }, { status: 400 })

  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setHours(23, 59, 59, 999)

  // Store staff are LOCKED to their store; a Super Admin targets the chosen store.
  const scope = { businessId: eff.businessId, storeId: eff.storeId }

  const [todaysOrders, todaysPickup, todaysDelivery, pendingReceipt, pendingAudit, pendingPayment, readyProcessing, readyDelivery, completedToday] = await Promise.all([
    prisma.laundryOrder.count({ where: { ...scope, createdAt: { gte: start, lte: end } } }),
    prisma.laundryOrder.count({ where: { ...scope, pickupRequired: true, pickupCompletedAt: null, status: { notIn: ["CANCELLED", "DELIVERED", "READY_FOR_DELIVERY"] } } }),
    prisma.laundryOrder.count({ where: { ...scope, deliveryRequired: true, deliveryCompletedAt: null, status: "READY_FOR_DELIVERY" } }),
    // Chain of custody: picked up by the executive, NOT yet scanned in by the store.
    prisma.laundryOrder.count({ where: { ...scope, status: "IN_TRANSIT_TO_STORE" } }),
    prisma.laundryOrder.count({ where: { ...scope, status: "PENDING_STORE_AUDIT" } }),
    prisma.laundryOrder.count({ where: { ...scope, status: "PAYMENT_PENDING" } }),
    prisma.laundryOrder.count({ where: { ...scope, status: "READY_FOR_PROCESSING" } }),
    prisma.laundryOrder.count({ where: { ...scope, status: "READY_FOR_DELIVERY" } }),
    prisma.laundryOrder.count({ where: { ...scope, status: "DELIVERED", deliveredAt: { gte: start, lte: end } } }),
  ])

  return NextResponse.json({
    success: true,
    data: { todaysOrders, todaysPickup, todaysDelivery, pendingReceipt, pendingAudit, pendingPayment, readyProcessing, readyDelivery, completedToday },
  })
}
