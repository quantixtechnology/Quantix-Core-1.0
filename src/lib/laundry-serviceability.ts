// ============================================================================
// QUANTIX — Laundry workspace serviceability seam
//
// The laundry layer's single entry point for the shared Address Serviceability
// engine. It is deliberately thin: it resolves the LaundryStore for a pickup
// address (nearest serviceable store when coordinates exist) and returns the
// snapshot the order persists. All radius/min-order/zone rules live in the
// platform engine (`core/address-serviceability.ts`) — nothing workspace-
// specific is encoded here beyond "laundry pickup coordinates → LaundryStore".
// ============================================================================

import { checkAddressServiceability } from "@/lib/core/address-serviceability"

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
 * `reason`) when the address is outside every store's current service radius —
 * the caller surfaces the "nearest store + distance + Change Address" card.
 * An address whose position cannot be established is refused too: serviceability
 * is never granted by default for an address that cannot be measured.
 */
export async function resolveLaundryStoreForPickup(input: {
  laundryBusinessId: string
  businessId: string // platform Business id (serviceability context)
  lat?: number | null
  lng?: number | null
  pickupAddressId?: string | null
  orderAmount?: number
}): Promise<LaundryStoreResolution> {
  // AN ADDRESS THAT CANNOT BE PLACED ON THE MAP CANNOT BE MEASURED AGAINST A
  // STORE'S CURRENT SERVICE RADIUS — AND THAT MEASUREMENT IS THE WHOLE POINT
  // OF THIS FUNCTION.
  //
  // There is deliberately NO "first active store" fallback here any more. Such
  // a fallback filed the customer against whatever store came first — in
  // practice the same store they had used before, whatever that store's
  // CURRENT location — so a customer whose saved address had no coordinates
  // kept booking after the store moved, because the radius rule never ran.
  // History must not grant serviceability: if the address cannot be verified
  // against the current store configuration, the booking is refused (the
  // /api/core/storefront/serviceability preview already refuses this same
  // shape), never silently approved.
  if (input.lat == null || input.lng == null || Number.isNaN(input.lat) || Number.isNaN(input.lng)) {
    return {
      ok: false,
      storeId: null,
      pickupAddressId: input.pickupAddressId ?? null,
      serviceabilityStatus: "OUT_OF_SERVICE_AREA",
      reason: "This address has no location coordinates. Please select the pin on the map to enable pickup.",
      status: 422,
    }
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
