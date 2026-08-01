// GET /api/core/storefront/laundry-slots?businessId=[&deliveryDate=yyyy-mm-dd][&date=yyyy-mm-dd]
// Public endpoint for the storefront. Returns generated time slots from
// LaundryOperationalConfig so the customer website is never hardcoded. When
// `deliveryDate` is supplied it also returns the delivery slots that have
// reached capacity (`delivery.fullSlots`) so the customer site can disable them.
// Also returns the store's Availability + Working Hours (Commerce Store/StoreTiming
// single source of truth). When `date` is supplied, the pickup/delivery slot
// lists are filtered to that day's working hours and a `dateAvailable` flag +
// reason are returned so unavailable days are never offered.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generateSlots, slotConfigsFrom, DEFAULT_PICKUP_SLOT, DEFAULT_DELIVERY_SLOT } from "@/lib/laundry-slots"
import { deliveryMaxPerSlot, deliverySlotCapacity } from "@/lib/laundry-slot-capacity"
import { getLaundryAvailability, isLaundryDateAvailable, laundrySlotsForDate } from "@/lib/laundry-availability"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const businessId = u.searchParams.get("businessId")
    const deliveryDate = u.searchParams.get("deliveryDate")
    const date = u.searchParams.get("date")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const [cfg, availability] = await Promise.all([
      prisma.laundryOperationalConfig.findUnique({ where: { businessId: biz.id } }),
      getLaundryAvailability(biz.id),
    ])
    const { pickup, delivery } = slotConfigsFrom(cfg)
    const pickupSlots = date ? laundrySlotsForDate(generateSlots(pickup), availability.timings, date, availability.closedUntil) : generateSlots(pickup)
    const deliverySlots = date ? laundrySlotsForDate(generateSlots(delivery), availability.timings, date, availability.closedUntil) : generateSlots(delivery)
    const data: {
      pickup: Record<string, unknown>
      delivery: Record<string, unknown>
    } = {
      pickup: { ...pickup, slots: pickupSlots },
      delivery: { ...delivery, slots: deliverySlots, maxPerSlot: deliveryMaxPerSlot(cfg) },
    }
    if (deliveryDate) {
      const capacity = await deliverySlotCapacity(biz.id, deliveryDate)
      data.delivery.fullSlots = capacity.full
      data.delivery.usage = capacity.usage
    }
    const dateAvailability = date ? isLaundryDateAvailable(availability.timings, date, availability.closedUntil) : null
    return NextResponse.json({
      success: true,
      data,
      availability: {
        storeId: availability.storeId,
        isOpen: availability.isOpen,
        reason: availability.reason,
        opensAt: availability.opensAt,
        closedReason: availability.closedReason,
        closedUntil: availability.closedUntil,
        businessHours: availability.businessHours,
        status: availability.status,
        timings: availability.timings,
      },
      dateAvailable: dateAvailability ? dateAvailability.available : null,
      dateReason: dateAvailability ? dateAvailability.reason : null,
    })
  } catch (e) {
    console.error("[storefront-laundry-slots] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
