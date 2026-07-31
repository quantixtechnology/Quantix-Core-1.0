// GET /api/core/storefront/laundry-slots?businessId=
// Public endpoint for the storefront. Returns generated time slots from
// LaundryOperationalConfig so the customer website is never hardcoded.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generateSlots, slotConfigsFrom, DEFAULT_PICKUP_SLOT, DEFAULT_DELIVERY_SLOT } from "@/lib/laundry-slots"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.findUnique({ where: { businessId: biz.id } })
    const { pickup, delivery } = slotConfigsFrom(cfg)
    return NextResponse.json({
      success: true,
      data: {
        pickup: { ...pickup, slots: generateSlots(pickup) },
        delivery: { ...delivery, slots: generateSlots(delivery) },
      },
    })
  } catch (e) {
    console.error("[storefront-laundry-slots] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
