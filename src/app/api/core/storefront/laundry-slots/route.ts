// GET /api/core/storefront/laundry-slots?businessId=[&deliveryDate=yyyy-mm-dd]
// Public endpoint for the storefront. Returns generated time slots from
// LaundryOperationalConfig so the customer website is never hardcoded. When
// `deliveryDate` is supplied it also returns the delivery slots that have
// reached capacity (`delivery.fullSlots`) so the customer site can disable them.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generateSlots, slotConfigsFrom, DEFAULT_PICKUP_SLOT, DEFAULT_DELIVERY_SLOT } from "@/lib/laundry-slots"
import { deliveryMaxPerSlot, deliverySlotCapacity } from "@/lib/laundry-slot-capacity"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const businessId = u.searchParams.get("businessId")
    const deliveryDate = u.searchParams.get("deliveryDate")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.findUnique({ where: { businessId: biz.id } })
    const { pickup, delivery } = slotConfigsFrom(cfg)
    const data: {
      pickup: Record<string, unknown>
      delivery: Record<string, unknown>
    } = {
      pickup: { ...pickup, slots: generateSlots(pickup) },
      delivery: { ...delivery, slots: generateSlots(delivery), maxPerSlot: deliveryMaxPerSlot(cfg) },
    }
    if (deliveryDate) {
      const capacity = await deliverySlotCapacity(biz.id, deliveryDate)
      data.delivery.fullSlots = capacity.full
      data.delivery.usage = capacity.usage
    }
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[storefront-laundry-slots] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
