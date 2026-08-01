// GET /api/laundry/availability?businessId=   — Laundry Workspace Settings:
//   Store Availability (Open / Temporarily Closed + reason + re-open) and
//   Working Hours (weekly schedule). Backed by the SAME platform `Store` +
//   `StoreTiming` records the storefront website resolves — no parallel model.
// PUT /api/laundry/availability
//   Body: { availability?: { status: "open"|"closed", reason?, closedUntil? },
//           timings?: [{ day, openTime, closeTime, isClosed }] }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { updateStoreTimings, getDefaultStoreTimings } from "@/lib/core/store"
import { getLaundryAvailability, resolvePlatformStore } from "@/lib/laundry-availability"

export const runtime = "nodejs"

// Convert a `YYYY-MM-DDTHH:mm` (assumed IST, the business's local zone) to a UTC
// Date for storage. Returns null on garbage input.
function istLocalToUtc(str: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(str ?? ""))
  if (!m) return null
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  if (isNaN(asUtc)) return null
  return new Date(asUtc - 5.5 * 60 * 60 * 1000)
}

const HHMM = (v: unknown, fallback: string): string => {
  const s = String(v ?? "").trim()
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : fallback
}

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const { storeId } = await resolvePlatformStore(biz.id)
    if (!storeId) return NextResponse.json({ success: false, error: "No online store configured for this business" }, { status: 404 })

    const [store, availability] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: { name: true, closedReason: true, closedUntil: true, storeTimings: { orderBy: { day: "asc" } } },
      }),
      getLaundryAvailability(biz.id),
    ])

    return NextResponse.json({
      success: true,
      data: {
        store: { id: storeId, name: store?.name || null },
        closedReason: store?.closedReason || null,
        closedUntil: store?.closedUntil ? store.closedUntil.toISOString() : null,
        timings: (store?.storeTimings && store.storeTimings.length > 0 ? store.storeTimings : getDefaultStoreTimings()),
        availability,
      },
    })
  } catch (e) {
    console.error("[laundry-availability] GET", e)
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const { storeId } = await resolvePlatformStore(biz.id)
    if (!storeId) return NextResponse.json({ success: false, error: "No online store configured for this business" }, { status: 404 })

    // ── 1. Working Hours (weekly schedule) — reuse Commerce updateStoreTimings ──
    if (Array.isArray(b.timings)) {
      const timings = b.timings
        .filter((t: { day?: number }) => typeof t.day === "number" && t.day >= 0 && t.day <= 6)
        .map((t: { day: number; openTime?: unknown; closeTime?: unknown; isClosed?: boolean }) => ({
          day: t.day,
          openTime: HHMM(t.openTime, "09:00"),
          closeTime: HHMM(t.closeTime, "21:00"),
          isClosed: !!t.isClosed,
        }))
      if (timings.length > 0) {
        try { await updateStoreTimings(storeId, timings) }
        catch (e) { return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed to save working hours" }, { status: 400 }) }
      }
    }

    // ── 2. Store Availability (Open / Temporarily Closed) ────────────────────
    const availability = (b.availability || {}) as { status?: string; reason?: string | null; closedUntil?: string | null }
    if (availability.status === "closed") {
      const closedUntil = istLocalToUtc(availability.closedUntil)
      await prisma.store.update({
        where: { id: storeId },
        data: {
          closedReason: availability.reason?.trim() ? availability.reason.trim() : null,
          closedUntil,
        },
      })
    } else if (availability.status === "open") {
      await prisma.store.update({ where: { id: storeId }, data: { closedReason: null, closedUntil: null } })
    }

    const fresh = await getLaundryAvailability(biz.id)
    return NextResponse.json({ success: true, data: { availability: fresh, timings: fresh.timings, message: "Store availability saved" } })
  } catch (e) {
    console.error("[laundry-availability] PUT", e)
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 })
  }
}
