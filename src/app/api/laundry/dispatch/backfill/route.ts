// POST /api/laundry/dispatch/backfill — one-time idempotent migration.
// Creates historical LaundryOrderEvent records for orders that were completed
// before the dispatch module existed. Safe to run multiple times; checks for
// existing events before inserting.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId } = body
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.edit")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const stats = { pickupCreated: 0, pickupSkipped: 0, deliveryCreated: 0, deliverySkipped: 0 }

    // ── Pickup backfill ────────────────────────────────────────────────────
    const pickupOrders = await prisma.laundryOrder.findMany({
      where: {
        businessId: biz.id,
        pickupRequired: true,
        pickupCompletedAt: { not: null },
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      select: {
        id: true, orderNumber: true, pickupCompletedAt: true, pickupExecutiveId: true,
        pickupAssignedAt: true, pickupAcceptedAt: true, pickupAcceptance: true,

      },
      take: 1000,
    })

    for (const o of pickupOrders) {
      const existing = await prisma.laundryOrderEvent.findFirst({
        where: { orderId: o.id, action: "PICKUP_COMPLETED" },
      })
      if (existing) { stats.pickupSkipped++; continue }

      // Create requested event if not present
      const hasRequested = await prisma.laundryOrderEvent.findFirst({
        where: { orderId: o.id, action: "PICKUP_REQUESTED" },
      })
      if (!hasRequested) {
        await prisma.laundryOrderEvent.create({
          data: {
            orderId: o.id, businessId: biz.id,
            toStatus: "DELIVERED", action: "PICKUP_REQUESTED",
            actorName: "System Migration",
            createdAt: o.pickupAssignedAt || o.pickupCompletedAt!,
          },
        })
      }

      // Create assigned event
      if (o.pickupExecutiveId) {
        const hasAssigned = await prisma.laundryOrderEvent.findFirst({
          where: { orderId: o.id, action: "PICKUP_ASSIGNED" },
        })
        if (!hasAssigned) {
          await prisma.laundryOrderEvent.create({
            data: {
              orderId: o.id, businessId: biz.id,
              toStatus: "DELIVERED", action: "PICKUP_ASSIGNED",
              actorName: "System Migration",
              note: o.pickupExecutiveId ? `→ ${o.pickupExecutiveId}` : null,
              createdAt: o.pickupAssignedAt || o.pickupCompletedAt!,
            },
          })
        }
      }

      // Create accepted event
      if (o.pickupAcceptance === "ACCEPTED") {
        const hasAccepted = await prisma.laundryOrderEvent.findFirst({
          where: { orderId: o.id, action: "PICKUP_ACCEPTED" },
        })
        if (!hasAccepted) {
          await prisma.laundryOrderEvent.create({
            data: {
              orderId: o.id, businessId: biz.id,
              toStatus: "DELIVERED", action: "PICKUP_ACCEPTED",
              actorName: o.pickupExecutiveId || null,
              createdAt: o.pickupAcceptedAt || o.pickupCompletedAt!,
            },
          })
        }
      }

      // Create completed event
      await prisma.laundryOrderEvent.create({
        data: {
          orderId: o.id, businessId: biz.id,
          toStatus: "DELIVERED", action: "PICKUP_COMPLETED",
          actorName: o.pickupExecutiveId || "System Migration",
          createdAt: o.pickupCompletedAt!,
        },
      })
      stats.pickupCreated++
    }

    // ── Delivery backfill ──────────────────────────────────────────────────
    const deliveryOrders = await prisma.laundryOrder.findMany({
      where: {
        businessId: biz.id,
        deliveryRequired: true,
        status: "DELIVERED",
        deliveredAt: { not: null },
      },
      select: {
        id: true, orderNumber: true, deliveredAt: true, deliveredBy: true, recipientName: true,
        deliveryExecutiveId: true, deliveryAssignedAt: true, deliveryAcceptedAt: true,
        deliveryAcceptance: true, deliveryCompletedAt: true,

      },
      take: 1000,
    })

    for (const o of deliveryOrders) {
      const existing = await prisma.laundryOrderEvent.findFirst({
        where: { orderId: o.id, action: "MARK_DELIVERED" },
      })
      if (existing) { stats.deliverySkipped++; continue }

      // Create requested event
      const hasRequested = await prisma.laundryOrderEvent.findFirst({
        where: { orderId: o.id, action: "DELIVERY_REQUESTED" },
      })
      if (!hasRequested) {
        await prisma.laundryOrderEvent.create({
          data: {
            orderId: o.id, businessId: biz.id,
            toStatus: "DELIVERED", action: "DELIVERY_REQUESTED",
            actorName: "System Migration",
            createdAt: o.deliveryAssignedAt || o.deliveredAt!,
          },
        })
      }

      // Create assigned event
      if (o.deliveryExecutiveId) {
        const hasAssigned = await prisma.laundryOrderEvent.findFirst({
          where: { orderId: o.id, action: "DELIVERY_ASSIGNED" },
        })
        if (!hasAssigned) {
          await prisma.laundryOrderEvent.create({
            data: {
              orderId: o.id, businessId: biz.id,
              toStatus: "DELIVERED", action: "DELIVERY_ASSIGNED",
              actorName: "System Migration",
              note: o.deliveryExecutiveId ? `→ ${o.deliveryExecutiveId}` : null,
              createdAt: o.deliveryAssignedAt || o.deliveredAt!,
            },
          })
        }
      }

      // Create delivered event
      const completedAt = o.deliveryCompletedAt || o.deliveredAt!
      await prisma.laundryOrderEvent.create({
        data: {
          orderId: o.id, businessId: biz.id,
          fromStatus: "READY_FOR_DELIVERY", toStatus: "DELIVERED",
          action: "MARK_DELIVERED",
          actorName: o.deliveredBy || o.deliveryExecutiveId || "System Migration",
          note: o.recipientName ? `Received by ${o.recipientName}` : null,
          createdAt: completedAt,
        },
      })
      stats.deliveryCreated++
    }

    return NextResponse.json({
      success: true,
      message: "Backfill complete",
      stats,
    })
  } catch (e) {
    console.error("[dispatch/backfill] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
