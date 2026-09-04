// GET /api/laundry/availability?businessId=&storeId=   — Laundry Workspace Settings:
//   Store Availability (Open / Temporarily Closed + reason + re-open), Working
//   Hours (weekly schedule), a Store selector (per-branch custom schedule), and
//   the business Standard Schedule (default timing for all stores).
// PUT /api/laundry/availability
//   Body: { businessId, storeId?,
//           availability?: { status: "open"|"closed", reason?, closedUntil? },
//           timings?: [{ day, openTime, closeTime, isClosed }],
//           branchTimings?: [{ day, openTime, closeTime, isClosed }],
//           statusOverride?: "AUTOMATIC"|"FORCE_OPEN"|"FORCE_CLOSED",
//           applyStandardSchedule?: boolean }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { updateStoreTimings, getStandardStoreSchedule } from "@/lib/core/store"
import { getLaundryAvailability, resolvePlatformStore, parseBranchHoursOverride, serializeBranchHoursOverride } from "@/lib/laundry-availability"
import { logActivity } from "@/lib/core/audit"
import { readCustomerOrderingMode, writeCustomerOrderingMode, isCustomerOrderingMode, writeBusinessClosure } from "@/lib/customer-ordering"

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

type TimingRow = { day: number; openTime?: string; closeTime?: string; open?: string; close?: string; isClosed?: boolean }
type CleanedTiming = { day: number; openTime: string; closeTime: string; isClosed: boolean }
function cleanTimings(list: unknown): CleanedTiming[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((t) => typeof (t as TimingRow)?.day === "number" && (t as TimingRow).day >= 0 && (t as TimingRow).day <= 6)
    .map((t): CleanedTiming => ({
      day: (t as TimingRow).day,
      openTime: HHMM((t as TimingRow).openTime ?? (t as TimingRow).open, "09:00"),
      closeTime: HHMM((t as TimingRow).closeTime ?? (t as TimingRow).close, "21:00"),
      isClosed: !!((t as TimingRow).isClosed),
    }))
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const businessId = url.searchParams.get("businessId")
    const storeId = url.searchParams.get("storeId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })


    const { storeId: platformStoreId } = await resolvePlatformStore(biz.id, storeId)
    const businessIdEff = biz.platformBusinessId || biz.id

    const [stores, standard, platformStore, branch] = await Promise.all([
      prisma.laundryStore.findMany({
        where: { laundryBusinessId: biz.id },
        select: { id: true, storeName: true, storeCode: true, isActive: true, statusOverride: true, businessHoursOverride: true },
        orderBy: { createdAt: "asc" },
      }),
      getStandardStoreSchedule(businessIdEff),
      platformStoreId
        ? prisma.store.findUnique({
            where: { id: platformStoreId },
            select: { name: true, closedReason: true, closedUntil: true, statusOverride: true, overrideExpiresAt: true, storeTimings: { orderBy: { day: "asc" } } },
          })
        : null,
      storeId ? prisma.laundryStore.findUnique({ where: { id: storeId }, select: { businessHoursOverride: true, statusOverride: true, overrideExpiresAt: true } }) : null,
    ])

    const availability = await getLaundryAvailability(biz.id, storeId)
    // Business-level, not per store: a tenant does not take orders round the
    // clock at one branch and not another.
    const bizRow = await prisma.business.findUnique({
      where: { id: biz.platformBusinessId || biz.id },
      select: { settings: true },
    }).catch(() => null)
    const customerOrderingMode = readCustomerOrderingMode(bizRow?.settings)
    const branchOverrideRows = parseBranchHoursOverride(branch?.businessHoursOverride)

    return NextResponse.json({
      success: true,
      data: {
        stores,
        standard: { timings: standard.timings, updatedAt: standard.updatedAt },
        store: storeId ? { id: storeId } : null,
        // Falls back to the business-level closure for a tenant with no platform
        // Store row, so the screen shows the state the owner actually set.
        closedReason: platformStore?.closedReason || availability.closedReason || null,
        closedUntil: platformStore?.closedUntil
          ? platformStore.closedUntil.toISOString()
          : (availability.closedUntil || null),
        statusOverride: branch?.statusOverride || platformStore?.statusOverride || "AUTOMATIC",
        overrideExpiresAt: branch?.overrideExpiresAt
          ? branch.overrideExpiresAt.toISOString()
          : (platformStore?.overrideExpiresAt ? platformStore.overrideExpiresAt.toISOString() : null),
        branchHours: branchOverrideRows,
        timings: branchOverrideRows.length > 0
          ? branchOverrideRows
          : (platformStore?.storeTimings && platformStore.storeTimings.length > 0 ? platformStore.storeTimings : []),
        availability,
        customerOrderingMode,
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

    const isOwner = !!guard.resolved.isOwner
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    // ── Customer Ordering Availability (business-level) ───────────────────
    // Its own branch: it belongs to the business, not to a store, and it must
    // not disturb any other key already in settings.
    if (b.customerOrderingMode !== undefined) {
      if (!isCustomerOrderingMode(b.customerOrderingMode)) {
        return NextResponse.json({ error: "Invalid customerOrderingMode" }, { status: 400 })
      }
      const target = biz.platformBusinessId || biz.id
      const current = await prisma.business.findUnique({ where: { id: target }, select: { settings: true } })
      await prisma.business.update({
        where: { id: target },
        data: { settings: writeCustomerOrderingMode(current?.settings, b.customerOrderingMode) },
      })
      return NextResponse.json({ success: true, customerOrderingMode: b.customerOrderingMode })
    }
    const { storeId } = await resolvePlatformStore(biz.id, b.storeId)
    // ── Open Store / Temporarily Closed with no platform Store row ──────────
    // The closure columns live on that row, so without one the owner had no
    // way to close the shop at all — the control simply 404'd. The business
    // already owns a deliberate-offline switch, `isOnline`, which every
    // availability path honours ahead of the clock, so the same control drives
    // that instead. Same one mechanism, same customer message, no new state.
    //
    // Only the availability status is handled here: working hours, branch
    // schedules and standard-schedule application all genuinely need a store
    // to write to, and still say so.
    if (!storeId) {
      const availability = (b.availability || {}) as { status?: string; reason?: string | null; closedUntil?: string | null }
      if (availability.status !== "open" && availability.status !== "closed") {
        return NextResponse.json({ success: false, error: "No online store configured for this business" }, { status: 404 })
      }
      const target = biz.platformBusinessId || biz.id
      const current = await prisma.business.findUnique({ where: { id: target }, select: { settings: true } })
      const closing = availability.status === "closed"
      await prisma.business.update({
        where: { id: target },
        data: {
          isOnline: !closing,
          settings: writeBusinessClosure(current?.settings, closing
            ? { reason: availability.reason ?? null, until: istLocalToUtc(availability.closedUntil) }
            : null),
        },
      })
      return NextResponse.json({ success: true, availability: { status: availability.status } })
    }
    const businessIdEff = biz.platformBusinessId || biz.id

    // ── 1. Working Hours (weekly schedule) on the platform store ────────────
    const timings = cleanTimings(b.timings)

    if (timings.length > 0) {
      try { await updateStoreTimings(storeId, timings) }
      catch (e) { return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed to save working hours" }, { status: 400 }) }
    }

    // ── 2. Store Availability (Open / Temporarily Closed) on the platform store ──
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

    // ── 3. Apply the business standard schedule to the selected store ───────
    if (b.applyStandardSchedule === true) {
      if (!isOwner) return NextResponse.json({ success: false, error: "Only the owner or super admin can apply the standard schedule" }, { status: 403 })
      const std = await getStandardStoreSchedule(businessIdEff)
      await updateStoreTimings(storeId, std.timings.map((t) => ({ day: t.day, openTime: t.openTime, closeTime: t.closeTime, isClosed: t.isClosed })))
      if (b.storeId) {
        await prisma.laundryStore.update({ where: { id: b.storeId }, data: { businessHoursOverride: "{}", statusOverride: "AUTOMATIC" } })
      }
    }

    // ── 4. Per-branch custom schedule + override (owner / super admin) ──────
    const overrideChanged = b.statusOverride && isOwner
    if (b.storeId) {
      const branchTimings = cleanTimings(b.branchTimings)
      const data: Record<string, unknown> = {}
      if (branchTimings.length > 0) {
        data.businessHoursOverride = serializeBranchHoursOverride(branchTimings)
      }
      if (overrideChanged) {
        data.statusOverride = ["AUTOMATIC", "FORCE_OPEN", "FORCE_CLOSED"].includes(b.statusOverride) ? b.statusOverride : "AUTOMATIC"
        if (b.overrideExpiresAt) {
          const exp = new Date(b.overrideExpiresAt)
          data.overrideExpiresAt = isNaN(exp.getTime()) ? null : exp
        } else if (data.statusOverride === "AUTOMATIC") {
          data.overrideExpiresAt = null
        }
      }
      if (Object.keys(data).length > 0) {
        const prev = await prisma.laundryStore.findUnique({ where: { id: b.storeId }, select: { statusOverride: true } })
        await prisma.laundryStore.update({ where: { id: b.storeId }, data })
        if (overrideChanged) {
          await logActivity({
            businessId: biz.platformBusinessId || biz.id,
            userId: guard.ctx.userId,
            action: "laundry.store.override",
            entity: "LaundryStore",
            entityId: b.storeId,
            details: {
              before: { statusOverride: prev?.statusOverride || "AUTOMATIC" },
              after: { statusOverride: data.statusOverride, overrideExpiresAt: data.overrideExpiresAt ? (data.overrideExpiresAt as Date).toISOString() : null },
              actor: guard.ctx.userName || null,
            },
            ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
            userAgent: request.headers.get("user-agent"),
          }).catch(() => {})
        }
      }
    } else if (overrideChanged) {
      // No branch targeted — apply the override to the resolved platform store
      // so per-store force open/closed also works on the storefront website.
      const val = ["AUTOMATIC", "FORCE_OPEN", "FORCE_CLOSED"].includes(b.statusOverride) ? b.statusOverride : "AUTOMATIC"
      const data: Record<string, unknown> = { statusOverride: val }
      if (b.overrideExpiresAt) {
        const exp = new Date(b.overrideExpiresAt)
        data.overrideExpiresAt = isNaN(exp.getTime()) ? null : exp
      } else if (val === "AUTOMATIC") {
        data.overrideExpiresAt = null
      }
      const prev = await prisma.store.findUnique({ where: { id: storeId }, select: { statusOverride: true } })
      await prisma.store.update({ where: { id: storeId }, data })
      await logActivity({
        businessId: biz.platformBusinessId || biz.id,
        userId: guard.ctx.userId,
        action: "store.override",
        entity: "Store",
        entityId: storeId,
        details: {
          before: { statusOverride: prev?.statusOverride || "AUTOMATIC" },
          after: { statusOverride: val, overrideExpiresAt: data.overrideExpiresAt ? (data.overrideExpiresAt as Date).toISOString() : null },
          actor: guard.ctx.userName || null,
        },
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => {})
    }

    const fresh = await getLaundryAvailability(biz.id, b.storeId)
    return NextResponse.json({ success: true, data: { availability: fresh, message: "Store availability saved" } })
  } catch (e) {
    console.error("[laundry-availability] PUT", e)
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 })
  }
}
