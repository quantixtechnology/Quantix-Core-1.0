// GET/PUT /api/laundry/slot-config?businessId= — the Delivery & Pickup time-slot
// windows stored on LaundryOperationalConfig. SINGLE SOURCE of slots for New
// Order, Ready for Delivery and the Storefront (all read src/lib/laundry-slots).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { DEFAULT_PICKUP_SLOT, DEFAULT_DELIVERY_SLOT, generateSlots, slotConfigsFrom } from "@/lib/laundry-slots"
import { DEFAULT_DELIVERY_MAX_PER_SLOT, deliveryMaxPerSlot, deliverySlotCapacity } from "@/lib/laundry-slot-capacity"

export const runtime = "nodejs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shape = (c: any) => {
  const { pickup, delivery } = slotConfigsFrom(c)
  return {
    pickup, delivery,
    pickupSlots: generateSlots(pickup),
    deliverySlots: generateSlots(delivery),
    deliveryMaxPerSlot: deliveryMaxPerSlot(c),
  }
}

const HHMM = (v: unknown, fallback: string): string => {
  const s = String(v ?? "").trim()
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : fallback
}
const dur = (v: unknown, fallback: number): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 30 ? n : fallback
}
const cap = (v: unknown, fallback: number): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export async function GET(request: Request) {
  try {
    const u = new URL(request.url)
    const businessId = u.searchParams.get("businessId")
    const deliveryDate = u.searchParams.get("deliveryDate")
    // View permission is broad — slots are needed by order-taking screens.
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: {}, create: { businessId: biz.id } })
    const data: Record<string, unknown> = shape(cfg)
    if (deliveryDate) {
      const capacity = await deliverySlotCapacity(biz.id, deliveryDate)
      data.deliveryFullSlots = capacity.full
      data.deliverySlotUsage = capacity.usage
    }
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[slot-config] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const p = b.pickup || {}
    const d = b.delivery || {}
    const data = {
      pickupSlotStart: HHMM(p.start, DEFAULT_PICKUP_SLOT.start),
      pickupSlotEnd: HHMM(p.end, DEFAULT_PICKUP_SLOT.end),
      pickupSlotDurationMin: dur(p.durationMin, DEFAULT_PICKUP_SLOT.durationMin),
      deliverySlotStart: HHMM(d.start, DEFAULT_DELIVERY_SLOT.start),
      deliverySlotEnd: HHMM(d.end, DEFAULT_DELIVERY_SLOT.end),
      deliverySlotDurationMin: dur(d.durationMin, DEFAULT_DELIVERY_SLOT.durationMin),
      deliveryMaxPerSlot: cap(d.maxPerSlot, DEFAULT_DELIVERY_MAX_PER_SLOT),
    }
    const cfg = await prisma.laundryOperationalConfig.upsert({ where: { businessId: biz.id }, update: data, create: { businessId: biz.id, ...data } })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) {
    console.error("[slot-config] PUT", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
