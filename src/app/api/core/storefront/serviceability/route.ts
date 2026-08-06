// ============================================================================
// QUANTIX CORE — Address Serviceability API
// POST /api/core/storefront/serviceability
//
// Public endpoint — the single source of truth for "can this ADDRESS be
// served?". Serviceability is keyed on the SELECTED DELIVERY ADDRESS (lat/lng),
// never on the device GPS. Works for every workspace (Store table for commerce,
// LaundryStore for laundry) through the shared Service Location engine.
//
// Body:
//   businessId?: string       — business context (or resolve via hostname/slug)
//   slug?: string
//   addressId?: string        — saved Address id (lat/lng resolved server-side)
//   lat? / lng?: number       — guest / inline coordinates (used when no addressId)
//   orderAmount?: number      — cart total (min-order + free-delivery rules)
// ============================================================================

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { prisma } from "@/lib/prisma"
import { resolveTenantFromHostname } from "@/lib/tenant-resolver"
import { checkAddressServiceability, getStorefrontSettings, listServiceLocationsWithDistance } from "@/lib/core/address-serviceability"
import type { ServiceLocation } from "@/lib/core/service-location"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string
      slug?: string
      addressId?: string
      lat?: number
      lng?: number
      orderAmount?: number
    }

    // ── Resolve business context ─────────────────────────────────────────────
    const hostnameBusinessId = await resolveTenantFromHostname(request)
    let resolvedBusinessId: string | null = hostnameBusinessId || body.businessId || null
    if (!resolvedBusinessId && body.slug) {
      const business = await db.business.findUnique({
        where: { slug: body.slug },
        select: { id: true, status: true },
      })
      if (!business || (business.status !== "ACTIVE" && business.status !== "ONBOARDING")) {
        return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })
      }
      resolvedBusinessId = business.id
    }
    if (!resolvedBusinessId) {
      return NextResponse.json(
        { success: false, error: "Cannot determine business context. Provide businessId, slug, or valid subdomain." },
        { status: 400 }
      )
    }

    // Resolve the business type (LAUNDRY vs STORE) so clients can branch on
    // the workspace kind — a LaundryBusiness is identified by its own id or
    // its linked platform Business id (same resolution as loadServiceLocations).
    const laundryBiz = await prisma.laundryBusiness.findFirst({
      where: { OR: [{ id: resolvedBusinessId }, { platformBusinessId: resolvedBusinessId }] },
      select: { id: true },
    })
    const businessType = laundryBiz ? "LAUNDRY" : "STORE"

    // ── Resolve the delivery coordinates from the ADDRESS (never device GPS) ─
    let lat: number | null = null
    let lng: number | null = null
    let resolvedAddressId: string | null = null

    if (body.addressId) {
      const address = await prisma.address.findUnique({ where: { id: body.addressId } })
      if (address) {
        if (address.latitude == null || address.longitude == null) {
          return NextResponse.json(
            { success: false, error: "This address has no location coordinates. Please select the pin on the map to enable delivery." },
            { status: 400 }
          )
        }
        lat = address.latitude
        lng = address.longitude
        resolvedAddressId = address.id
      }
    } else if (typeof body.lat === "number" && typeof body.lng === "number" && !Number.isNaN(body.lat) && !Number.isNaN(body.lng)) {
      lat = body.lat
      lng = body.lng
    }

    if (lat === null || lng === null) {
      return NextResponse.json(
        { success: false, error: "Provide addressId (saved address) or lat/lng coordinates." },
        { status: 400 }
      )
    }

    // ── Run the shared engine ────────────────────────────────────────────────
    const result = await checkAddressServiceability({
      businessId: resolvedBusinessId,
      lat,
      lng,
      orderAmount: body.orderAmount,
    })

    const settings = await getStorefrontSettings(resolvedBusinessId)

    // Include full nearest-store details (via the shared abstraction) so the UI
    // can show the store, distance, fees, and the "outside service area" card.
    let nearestLocation: ServiceLocation | null = null
    if (result.nearestStoreId) {
      const locations = await listServiceLocationsWithDistance(resolvedBusinessId, lat, lng)
      nearestLocation = locations.find((l) => l.id === result.nearestStoreId) || null
    }

    const nearestStore = nearestLocation
      ? {
          id: nearestLocation.id,
          kind: nearestLocation.kind,
          name: nearestLocation.name,
          address: nearestLocation.address,
          city: nearestLocation.city,
          state: nearestLocation.state,
          pincode: nearestLocation.pincode,
          latitude: nearestLocation.latitude,
          longitude: nearestLocation.longitude,
          serviceRadiusKm: nearestLocation.serviceRadiusKm,
          pickupRadiusKm: (nearestLocation as { pickupRadiusKm?: number }).pickupRadiusKm ?? null,
          deliveryFee: nearestLocation.deliveryFee ?? null,
          freeDeliveryAbove: nearestLocation.freeDeliveryAbove ?? null,
          minOrderAmount: nearestLocation.minOrderAmount ?? null,
          preparationTime: nearestLocation.preparationTime ?? null,
          distance: (nearestLocation as { distanceKm?: number | null }).distanceKm ?? null,
          distanceKm: (nearestLocation as { distanceKm?: number | null }).distanceKm ?? null,
          serviceable: (nearestLocation as { serviceable?: boolean }).serviceable ?? null,
        }
      : null

    const distance = result.distance ?? nearestStore?.distanceKm ?? null

    return NextResponse.json({
      success: true,
      data: {
        serviceable: result.serviceable,
        code: result.serviceable ? undefined : "OUT_OF_SERVICE_AREA",
        reason: result.reason ?? (result.serviceable ? undefined : "This address is outside our service area."),
        distance,
        distanceKm: distance,
        deliveryFee: result.deliveryFee ?? null,
        estimatedTime: result.estimatedTime ?? null,
        freeDeliveryAbove: result.freeDeliveryAbove ?? null,
        minOrderAmount: result.minOrderAmount ?? null,
        matchedZoneId: result.matchedZoneId ?? null,
        matchedZoneName: result.matchedZoneName ?? null,
        locationKind: result.locationKind ?? nearestStore?.kind ?? null,
        businessType,
        nearestStore,
        assignedStore: nearestStore,
        addressId: resolvedAddressId,
        settings,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check serviceability"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
