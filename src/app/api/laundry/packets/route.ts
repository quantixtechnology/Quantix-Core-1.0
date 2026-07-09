// GET /api/laundry/packets?businessId=&code=&status=
// Packet lookup for the Processing Center receive screen (QR scan / manual
// code entry) and transit queues. `code` matches the packet number, QR value
// or the order number.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const biz = await resolveLaundryBusiness(sp.get("businessId"))
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const code = (sp.get("code") || "").trim()
    const status = sp.get("status")

    const where: Record<string, unknown> = { businessId: biz.id }
    if (status) where.status = status
    if (code) {
      where.OR = [
        { packetNumber: code }, { qrValue: code },
        { order: { orderNumber: code } },
        // QR scanners sometimes deliver the code inside a URL / with whitespace
        { packetNumber: { contains: code } },
      ]
    }

    const packets = await prisma.laundryPacket.findMany({
      where: where as never,
      include: {
        order: {
          select: {
            id: true, orderNumber: true, status: true, customerId: true, expectedDeliveryDate: true,
            store: { select: { storeName: true, storeCode: true } },
            _count: { select: { items: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: code ? 5 : 50,
    })

    const custIds = [...new Set(packets.map((p) => p.order.customerId).filter(Boolean) as string[])]
    const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } }) : []
    const cmap = new Map(custs.map((c) => [c.id, c]))

    return NextResponse.json({
      success: true,
      data: packets.map((p) => ({
        ...p,
        customer: p.order.customerId ? cmap.get(p.order.customerId) || null : null,
        itemCount: p.itemCount || p.order._count.items,
      })),
    })
  } catch (e) {
    console.error("[laundry-packets] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
