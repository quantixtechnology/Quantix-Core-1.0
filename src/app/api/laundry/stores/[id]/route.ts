import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { assertValidStoreLocation } from "@/lib/core/store"
import { processingAssignmentRefusal, requiresProcessingCenterAssignment } from "@/lib/laundry-store-eligibility"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryStore.findUnique({ where: { id }, select: { laundryBusinessId: true, storeType: true, isActive: true, storeCode: true, storeName: true, processingCenterStoreId: true } })
    if (!existing) return NextResponse.json({ error: "Store not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, existing.laundryBusinessId, "laundry.stores.edit")
    if (!guard.ok) return guard.res
    const body = await request.json()
    const { storeName, storeType, managerName, mobile, email, address, city, state, pincode, latitude, longitude, googlePlaceId, formattedAddress, serviceRadiusKm, dailyCapacityKg, isActive, processingCenterStoreId } = body

    if (latitude !== undefined || longitude !== undefined) {
      assertValidStoreLocation({
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        googlePlaceId: googlePlaceId || null,
      })
    }

    // ── Processing Center assignment — BACKEND enforcement ───────────────
    // Evaluated against the EFFECTIVE state after this edit, so activating a
    // legacy store, or switching a BOTH location to retail-only, is caught.
    const effectiveType = storeType !== undefined ? storeType : existing.storeType
    const effectiveActive = isActive !== undefined ? !!isActive : existing.isActive
    const centreChanged = processingCenterStoreId !== undefined
    const effectiveCentreId = requiresProcessingCenterAssignment(effectiveType)
      ? (centreChanged ? (processingCenterStoreId || null) : existing.processingCenterStoreId)
      : null
    const centre = effectiveCentreId
      ? await prisma.laundryStore.findFirst({
          where: { id: effectiveCentreId, laundryBusinessId: existing.laundryBusinessId },
          select: { id: true, storeType: true, isActive: true, storeCode: true, storeName: true },
        })
      : null
    const refusal = processingAssignmentRefusal({
      storeType: effectiveType,
      isActive: effectiveActive,
      storeId: id,
      centre,
      requestedCentreId: effectiveCentreId,
    })
    if (refusal) return NextResponse.json({ error: refusal, code: "PROCESSING_CENTER_REQUIRED" }, { status: 400 })

    const assignmentMoved = effectiveCentreId !== (existing.processingCenterStoreId ?? null)

    const store = await prisma.laundryStore.update({
      where: { id },
      data: {
        ...(storeName !== undefined && { storeName }),
        ...(storeType !== undefined && { storeType }),
        ...(managerName !== undefined && { managerName: managerName || null }),
        ...(mobile !== undefined && { mobile: mobile || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(pincode !== undefined && { pincode: pincode || null }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(googlePlaceId !== undefined && { googlePlaceId: googlePlaceId || null }),
        ...(formattedAddress !== undefined && { formattedAddress: formattedAddress || null }),
        ...(serviceRadiusKm !== undefined && { serviceRadiusKm: serviceRadiusKm ? parseFloat(serviceRadiusKm) : null }),
        ...(dailyCapacityKg !== undefined && { dailyCapacityKg: dailyCapacityKg ? parseFloat(dailyCapacityKg) : null }),
        ...(isActive !== undefined && { isActive }),
        // A type change to PROCESSING_CENTER/BOTH clears the assignment: such a
        // location processes its own work, so a dangling pointer would be a lie.
        ...(assignmentMoved && { processingCenterStoreId: effectiveCentreId, processingCenterAssignedAt: effectiveCentreId ? new Date() : null }),
      },
    })

    // ── Audit footprint — WHO moved this store's processing, and from where ──
    // Reuses the existing LaundryAuditLog (no new audit model). Append-only:
    // the previous assignment is recorded, never overwritten.
    if (assignmentMoved) {
      const prev = existing.processingCenterStoreId
        ? await prisma.laundryStore.findUnique({ where: { id: existing.processingCenterStoreId }, select: { storeCode: true, storeName: true } })
        : null
      const label = (c: { storeCode?: string | null; storeName?: string | null } | null) =>
        c ? [c.storeCode, c.storeName].filter(Boolean).join(" — ") : "Not assigned"
      await prisma.laundryAuditLog.create({
        data: {
          businessId: existing.laundryBusinessId,
          actorId: guard.ctx?.userId ?? null,
          actorName: guard.ctx?.userName ?? "System",
          section: "STORE_PROCESSING_CENTER",
          field: `${existing.storeCode} — ${existing.storeName}`,
          oldValue: label(prev),
          newValue: label(centre),
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
        },
      }).catch(() => null)
    }

    return NextResponse.json(store)
  } catch (error) {
    console.error("Error updating laundry store:", error)
    return NextResponse.json({ error: "Failed to update laundry store" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await prisma.laundryStore.findUnique({ where: { id }, select: { laundryBusinessId: true } })
    if (!existing) return NextResponse.json({ error: "Store not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, existing.laundryBusinessId, "laundry.stores.delete")
    if (!guard.ok) return guard.res
    await prisma.laundryStore.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting laundry store:", error)
    return NextResponse.json({ error: "Failed to delete laundry store" }, { status: 500 })
  }
}
