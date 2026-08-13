// ============================================================================
// QUANTIX — Laundry workspace serviceability seam
//
// The laundry layer's single entry point for the shared Address Serviceability
// engine. It is deliberately thin: it resolves the LaundryStore for a pickup
// address (nearest serviceable store when coordinates exist, first active store
// for legacy flows without coordinates) and returns the snapshot the order
// persists. All radius/min-order/zone rules live in the platform engine
// (`core/address-serviceability.ts`) — nothing workspace-specific is encoded
// here beyond "laundry pickup coordinates → LaundryStore".
// ============================================================================

import { prisma } from "@/lib/prisma"
import { checkAddressServiceability } from "@/lib/core/address-serviceability"
import { customerFacingStoreWhere } from "@/lib/laundry-store-eligibility"

export interface LaundryStoreResolution {
  ok: boolean
  storeId: string | null
  pickupAddressId?: string | null
  pickupDistanceKm?: number | null
  serviceabilityStatus?: string | null
  deliveryZoneId?: string | null
  reason?: string
  error?: string
  status?: number
  nearestStore?: {
    id: string
    name: string
    distance: number | null
    serviceable: boolean | null
  } | null
}

/**
 * Resolve the LaundryStore an order should be assigned to, keyed on the pickup
 * address coordinates. Returns OUT_OF_SERVICE_AREA (via `ok:false` +
 * `reason`) when the address has coordinates but is outside every store's
 * service radius — the caller surfaces the "nearest store + distance + Change
 * Address" card. Without coordinates we keep the legacy "first active store"
 * behaviour so older clients never break.
 */
export async function resolveLaundryStoreForPickup(input: {
  laundryBusinessId: string
  businessId: string // platform Business id (serviceability context)
  lat?: number | null
  lng?: number | null
  pickupAddressId?: string | null
  orderAmount?: number
}): Promise<LaundryStoreResolution> {
  const legacy = async (): Promise<LaundryStoreResolution> => {
    const store = await prisma.laundryStore.findFirst({
      // No coordinates → no distance to compute, but the store picked here is
      // still the CUSTOMER's store, so a Processing Center is not a candidate.
      // Without this the "first active store" fallback could file a customer's
      // order against an internal facility.
      where: { laundryBusinessId: input.laundryBusinessId, isActive: true, ...customerFacingStoreWhere },
      select: { id: true },
    })
    if (!store) return { ok: false, storeId: null, error: "No active store configured", status: 400 }
    return { ok: true, storeId: store.id }
  }

  if (input.lat == null || input.lng == null || Number.isNaN(input.lat) || Number.isNaN(input.lng)) {
    return legacy()
  }

  const svc = await checkAddressServiceability({
    businessId: input.businessId,
    lat: input.lat,
    lng: input.lng,
    orderAmount: input.orderAmount,
  })

  if (!svc.serviceable || !svc.nearestStoreId) {
    return {
      ok: false,
      storeId: svc.nearestStoreId ?? null,
      pickupAddressId: input.pickupAddressId ?? null,
      serviceabilityStatus: "OUT_OF_SERVICE_AREA",
      reason: svc.reason || "We don't deliver to this address yet.",
      status: 422,
      nearestStore: {
        id: svc.nearestStoreId || "",
        name: svc.nearestStoreName || "",
        distance: svc.distance ?? null,
        serviceable: false,
      },
    }
  }

  return {
    ok: true,
    storeId: svc.nearestStoreId,
    pickupAddressId: input.pickupAddressId ?? null,
    pickupDistanceKm: svc.distance ?? null,
    serviceabilityStatus: "SERVICEABLE",
    deliveryZoneId: svc.matchedZoneId ?? null,
    nearestStore: {
      id: svc.nearestStoreId,
      name: svc.nearestStoreName || "",
      distance: svc.distance ?? null,
      serviceable: true,
    },
  }
}
