import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      include: {
        services: true,
        items: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
        store: { select: { storeName: true, storeCode: true } },
        timestamps: {
          include: { stage: { select: { name: true, code: true, sequence: true } } },
          orderBy: { createdAt: "desc" },
        },
        events: { orderBy: { createdAt: "desc" } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Attach the customer (platform Customer, referenced by id) for display.
    let customer: { id: string; name: string; phone: string | null; customerCode: string | null } | null = null
    if (order.customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { id: true, name: true, phone: true, customerCode: true },
      }).catch(() => null)
    }

    return NextResponse.json({ success: true, data: { ...order, customer } })
  } catch (error) {
    console.error("[laundry-order-detail] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
