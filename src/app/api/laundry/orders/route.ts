import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, storeId, customerId, orderType, services, expectedDeliveryDate, paymentPreference, notes, specialInstructions, deliveryOverride, overrideReason, pickupDate, pickupTimeSlot, pickupAddress, pickupInstructions, createdBy } = body

    if (!businessId || !storeId) {
      return NextResponse.json({ error: "Missing required fields: businessId, storeId" }, { status: 400 })
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: "At least one service must be selected" }, { status: 400 })
    }

    const store = await prisma.laundryStore.findFirst({
      where: { id: storeId, laundryBusinessId: businessId },
    })
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 })
    }

    if (customerId) {
      const business = await prisma.laundryBusiness.findUnique({
        where: { id: businessId },
        select: { platformBusinessId: true },
      })
      if (business?.platformBusinessId) {
        const customer = await prisma.customer.findFirst({
          where: { id: customerId, businessId: business.platformBusinessId },
        })
        if (!customer) {
          return NextResponse.json({ error: "Customer not found" }, { status: 404 })
        }
      }
    }

    const now = new Date()
    const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
    const prefix = `ORD-${monthPrefix}-`

    const lastOrder = await prisma.laundryOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    })

    let nextSeq = 1
    if (lastOrder) {
      const parts = lastOrder.orderNumber.split("-")
      nextSeq = parseInt(parts[parts.length - 1], 10) + 1
    }
    const orderNumber = `${prefix}${String(nextSeq).padStart(6, "0")}`

    const order = await prisma.laundryOrder.create({
      data: {
        orderNumber,
        businessId,
        storeId,
        customerId: customerId || null,
        orderType: orderType || "WALK_IN",
        source: "MANUAL",
        status: "PENDING_STORE_AUDIT",
        paymentPreference: paymentPreference || "COD",
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        deliveryOverride: deliveryOverride || false,
        overrideReason: overrideReason || null,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        pickupTimeSlot: pickupTimeSlot || null,
        pickupAddress: pickupAddress || null,
        pickupInstructions: pickupInstructions || null,
        specialInstructions: specialInstructions || null,
        notes: notes || null,
        createdBy: createdBy || null,
        services: {
          create: services.map((s: { serviceId?: string; serviceName: string; turnaroundHours?: number }) => ({
            serviceId: s.serviceId || null,
            serviceName: s.serviceName,
            turnaroundHours: s.turnaroundHours || 24,
          })),
        },
      },
      include: {
        services: true,
        store: { select: { storeName: true, storeCode: true } },
      },
    })

    await prisma.laundryAuditLog.create({
      data: {
        businessId,
        actorId: createdBy || "system",
        actorName: createdBy || "System",
        section: "ORDER_CREATION",
        field: "orderNumber",
        oldValue: null,
        newValue: orderNumber,
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      },
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error("[laundry-orders] POST Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const status = searchParams.get("status")
    const storeId = searchParams.get("storeId")
    const customerId = searchParams.get("customerId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const search = searchParams.get("search")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 })
    }

    const where: Record<string, unknown> = { businessId }
    if (status) where.status = status
    if (storeId) where.storeId = storeId
    if (customerId) where.customerId = customerId
    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.gte = new Date(from)
      if (to) createdAt.lte = new Date(to)
      where.createdAt = createdAt
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { notes: { contains: search } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.laundryOrder.findMany({
        where: where as any,
        include: {
          services: true,
          store: { select: { storeName: true, storeCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.laundryOrder.count({ where: where as any }),
    ])

    return NextResponse.json({ success: true, data: orders, total, limit, offset })
  } catch (error) {
    console.error("[laundry-orders] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
