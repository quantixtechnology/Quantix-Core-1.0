import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent } from "@/lib/laundry-field-ops"
import { generateOrderNumber } from "@/lib/laundry-codes"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, customerId, customerData, pickupAddress, pickupDate, pickupTimeSlot, services, notes, executiveId } = body
    if (!businessId || (!customerId && !customerData?.name))
      return NextResponse.json({ error: "businessId and customerId or customerData.name required" }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    let custId = customerId
    if (!custId) {
      const phone = customerData.phone || null
      if (phone) {
        const existing = await prisma.customer.findFirst({
          where: { phone, businessId: biz.id },
          select: { id: true },
        })
        if (existing) {
          custId = existing.id
        } else {
          const c = await prisma.customer.create({
            data: { businessId: biz.id, name: customerData.name, phone },
            select: { id: true },
          })
          custId = c.id
        }
      } else {
        const c = await prisma.customer.create({
          data: { businessId: biz.id, name: customerData.name },
          select: { id: true },
        })
        custId = c.id
      }
    }

    // Check for existing active pickup
    const activePickup = await prisma.laundryOrder.findFirst({
      where: {
        customerId: custId, businessId: biz.id,
        pickupRequired: true,
        status: { notIn: ["DELIVERED", "CANCELLED"] },
        pickupCompletedAt: null,
      },
      select: { id: true, orderNumber: true, pickupExecutiveId: true, pickupDate: true, pickupTimeSlot: true, fieldStatus: true },
      orderBy: { createdAt: "desc" },
    })
    if (activePickup) {
      return NextResponse.json({
        success: true,
        data: activePickup,
        existing: true,
        message: `Active pickup already exists — ${activePickup.orderNumber}`,
      })
    }

    const store = await prisma.laundryStore.findFirst({
      where: { laundryBusinessId: biz.id, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, storeCode: true },
    })
    // storeId is a required relation on LaundryOrder — a pickup order cannot be
    // created without an owning store (same invariant the order engine enforces).
    if (!store) return NextResponse.json({ error: "No active store configured for this business." }, { status: 400 })

    // orderNumber is required (no DB default) — mint it through the same
    // enterprise generator every other order path uses (ORD-{storeCode}-NNNNNN).
    const orderNumber = await generateOrderNumber(store.storeCode)

    let svcRecords: { id: string; name: string }[] = []
    if (services?.length) {
      svcRecords = await prisma.laundryService.findMany({
        where: { businessId: biz.id, name: { in: services.map((s: string) => s) } },
        select: { id: true, name: true },
      })
    }

    const execId: string | null = executiveId || null

    const order = await prisma.laundryOrder.create({
      data: {
        businessId: biz.id,
        storeId: store.id,
        orderNumber,
        customerId: custId,
        orderType: "HOME_PICKUP",
        pickupRequired: true,
        deliveryRequired: true,
        pickupAddress: pickupAddress || null,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        pickupTimeSlot: pickupTimeSlot || null,
        notes: notes || null,
        pickupExecutiveId: execId,
        pickupAssignedAt: execId ? new Date() : null,
        status: "AWAITING_PICKUP_ASSIGNMENT",
        fieldStatus: execId ? "ASSIGNED" : null,
        ...(svcRecords.length ? { services: { create: svcRecords.map((svc) => ({ serviceId: svc.id, serviceName: svc.name })) } } : {}),
      },
      select: {
        id: true, orderNumber: true, customerId: true,
        pickupAddress: true, pickupDate: true, pickupTimeSlot: true,
        pickupExecutiveId: true, fieldStatus: true, status: true,
      },
    })

    await logFieldEvent({
      orderId: order.id, businessId: biz.id,
      action: "PICKUP_REQUESTED",
      note: execId ? `Assigned to executive` : "Awaiting assignment",
      actor: { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff" },
    })

    return NextResponse.json({ success: true, data: order, existing: false }, { status: 201 })
  } catch (e) {
    console.error("[dispatch/pickup] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
