// GET /api/core/storefront/laundry-slots?businessId= — PUBLIC pickup/delivery
// time slots for the customer storefront. Reads the SAME LaundryOperationalConfig
// window as the admin (Settings → Time Slots) via src/lib/laundry-slots, so the
// customer sees exactly the slots staff configured. Slots are not sensitive → no auth.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generateSlots, slotConfigsFrom } from "@/lib/laundry-slots"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.findUnique({ where: { businessId: biz.id } })
    const { pickup, delivery } = slotConfigsFrom(cfg)
    return NextResponse.json({ success: true, data: { pickupSlots: generateSlots(pickup), deliverySlots: generateSlots(delivery) } })
  } catch (e) {
    console.error("[storefront-laundry-slots] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
