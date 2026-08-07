// ============================================================================
// QUANTIX CORE — Service Location Providers
//
// The ONLY file that maps a workspace's own store table into the shared
// `ServiceLocation` abstraction. This is pure plumbing — no serviceability
// business logic lives here (that is `service-location.ts`).
//
// Every new workspace that wants the shared engine simply adds its store-table
// mapping here. Nothing else in the platform needs to change.
// ============================================================================

import { db } from "@/lib/db"
import { prisma } from "@/lib/prisma"
import type { ServiceLocation } from "./service-location"

/**
 * Load every customer-facing service location for a business as the shared
 * `ServiceLocation` shape. Resolution order:
 *
 *   1. Laundry workspace — LaundryBusiness may be entered by its own id OR the
 *      linked platform Business id (`platformBusinessId`). Its locations come
 *      from the LaundryStore operational table (radius = serviceRadiusKm).
 *   2. Everything else — the generic Store table (radius = deliveryRadius).
 *
 * No workspace business logic is applied here, only the table→abstraction map.
 */
export async function loadServiceLocations(businessId: string): Promise<ServiceLocation[]> {
  if (!businessId) return []

  const laundry = await prisma.laundryBusiness.findFirst({
    where: { OR: [{ id: businessId }, { platformBusinessId: businessId }] },
    select: { id: true },
  })

  if (laundry) {
    const stores = await prisma.laundryStore.findMany({
      where: { laundryBusinessId: laundry.id, isActive: true },
    })
    return stores.map((s): ServiceLocation => ({
      id: s.id,
      businessId,
      kind: "laundryStore",
      name: s.storeName,
      latitude: s.latitude ?? 0,
      longitude: s.longitude ?? 0,
      serviceRadiusKm: s.serviceRadiusKm && s.serviceRadiusKm > 0 ? s.serviceRadiusKm : 5,
      maxDeliveryDistanceKm: s.serviceRadiusKm && s.serviceRadiusKm > 0 ? s.serviceRadiusKm : 5,
      isActive: s.isActive,
      googlePlaceId: s.googlePlaceId ?? null,
      address: s.address,
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      statusOverride: s.statusOverride ?? null,
      businessHoursOverride: s.businessHoursOverride ?? null,
    }))
  }

  const stores = await db.store.findMany({
    where: { businessId, status: "ACTIVE" },
  })
  return stores.map((s): ServiceLocation => ({
    id: s.id,
    businessId,
    kind: "store",
    name: s.name,
    latitude: s.latitude ?? 0,
    longitude: s.longitude ?? 0,
    serviceRadiusKm: s.deliveryRadius && s.deliveryRadius > 0 ? s.deliveryRadius : 5,
    pickupRadiusKm: s.pickupRadiusKm && s.pickupRadiusKm > 0 ? s.pickupRadiusKm : s.deliveryRadius && s.deliveryRadius > 0 ? s.deliveryRadius : 5,
    defaultMapZoom: s.defaultMapZoom ?? undefined,
    maxDeliveryDistanceKm: s.maxDeliveryDistance ?? null,
    isActive: s.status === "ACTIVE",
    googlePlaceId: s.googlePlaceId ?? null,
    address: s.address,
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    deliveryFee: s.deliveryFee,
    freeDeliveryAbove: s.freeDeliveryAbove,
    minOrderAmount: s.minOrderAmount,
    preparationTime: s.preparationTime,
  }))
}
