import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateStoreCode } from "@/lib/laundry-codes"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { assertValidStoreLocation } from "@/lib/core/store"
import { processingAssignmentRefusal, requiresProcessingCenterAssignment } from "@/lib/laundry-store-eligibility"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireLaundryPermission(request, id, "laundry.stores.view")
    if (!guard.ok) return guard.res
    // Accept either LaundryBusiness.id or the platform Business.id.
    const resolved = await resolveLaundryBusiness(id)
    const stores = resolved ? await prisma.laundryStore.findMany({
      where: { laundryBusinessId: resolved.id },
      orderBy: { createdAt: "desc" },
      // The assigned centre travels with the store so the list and the edit
      // form can show WHERE this store's garments are processed without a
      // second round trip. Internal view — every store type is returned.
      include: { processingCenter: { select: { id: true, storeCode: true, storeName: true, city: true, isActive: true } } },
    }) : []
    // A legacy row simply has no processingCenter — the list renders that as
    // "Required". No extra flag is needed to say the same thing twice.
    return NextResponse.json(stores)
  } catch (error) {
    console.error("Error fetching laundry stores:", error)
    return NextResponse.json({ error: "Failed to fetch laundry stores" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireLaundryPermission(request, id, "laundry.stores.create")
    if (!guard.ok) return guard.res
    const body = await request.json()
    const { storeName, storeType, managerName, mobile, email, address, city, state, pincode, latitude, longitude, googlePlaceId, formattedAddress, serviceRadiusKm, dailyCapacityKg, isActive, processingCenterStoreId } = body

    if (!storeName) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 })
    }

    assertValidStoreLocation({
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      googlePlaceId: googlePlaceId || null,
    })

    // Accept either LaundryBusiness.id or the platform Business.id (self-heals
    // the workspace link if missing) — same resolution the GET uses.
    const resolved = await resolveLaundryBusiness(id)
    if (!resolved) {
      return NextResponse.json({ error: `No laundry workspace matches businessId "${id}"` }, { status: 404 })
    }
    const laundryBusinessId = resolved.id

    const business = await prisma.laundryBusiness.findUnique({
      where: { id: laundryBusinessId },
      select: { businessCode: true },
    })
    if (!business) {
      return NextResponse.json({ error: "Laundry workspace not found" }, { status: 404 })
    }

    const limits = await prisma.laundryScalingLimit.findUnique({ where: { businessId: laundryBusinessId } })
    if (limits && limits.storesUsed >= limits.storesAllowed) {
      return NextResponse.json({ error: `Store limit reached (${limits.storesAllowed}). Contact Quantix to increase capacity.` }, { status: 403 })
    }

    // ── Processing Center assignment — BACKEND enforcement ───────────────
    // The UI blocks this too, but a direct API call must not be able to
    // create an ACTIVE retail store with nowhere to process its garments.
    const wantsActive = isActive !== undefined ? !!isActive : true
    const needsCentre = requiresProcessingCenterAssignment(storeType || "RETAIL_STORE")
    const centreId = needsCentre ? (processingCenterStoreId || null) : null
    const centre = centreId
      ? await prisma.laundryStore.findFirst({
          // Tenant-scoped: a centre from another business is "not found".
          where: { id: centreId, laundryBusinessId },
          select: { id: true, storeType: true, isActive: true },
        })
      : null
    const refusal = processingAssignmentRefusal({
      storeType: storeType || "RETAIL_STORE",
      isActive: wantsActive,
      centre,
      requestedCentreId: centreId,
    })
    if (refusal) return NextResponse.json({ error: refusal, code: "PROCESSING_CENTER_REQUIRED" }, { status: 400 })

    const storeCode = await generateStoreCode(business.businessCode)

    const store = await prisma.laundryStore.create({
      data: {
        storeCode,
        laundryBusinessId,
        storeName,
        storeType: storeType || "RETAIL_STORE",
        managerName: managerName || null,
        mobile: mobile || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        googlePlaceId: googlePlaceId || null,
        formattedAddress: formattedAddress || null,
        serviceRadiusKm: serviceRadiusKm ? parseFloat(serviceRadiusKm) : null,
        dailyCapacityKg: dailyCapacityKg ? parseFloat(dailyCapacityKg) : null,
        isActive: isActive !== undefined ? isActive : true,
        processingCenterStoreId: centreId,
        processingCenterAssignedAt: centreId ? new Date() : null,
      },
    })

    // Safe increment — never fails the create if no scaling-limit row exists.
    await prisma.laundryScalingLimit.updateMany({
      where: { businessId: laundryBusinessId },
      data: { storesUsed: { increment: 1 } },
    })

    return NextResponse.json(store, { status: 201 })
  } catch (error) {
    console.error("Error creating laundry store:", error)
    return NextResponse.json({ error: "Failed to create laundry store" }, { status: 500 })
  }
}
