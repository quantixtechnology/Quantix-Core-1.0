// ============================================================================
// QUANTIX CORE — Address Serviceability (platform layer)
//
// The thin platform-facing service that ties together the pure Service
// Location engine (`service-location.ts`) with the workspace location providers
// (`service-location-providers.ts`) and per-business storefront rules
// (StorefrontSettings + DeliveryZone). API routes call THIS — never the pure
// engine directly, and never the workspace tables directly.
// ============================================================================

import { db } from "@/lib/db"
import { haversineDistance } from "./service-location"
import {
  evaluateServiceability,
  type ServiceLocation,
  type ServiceabilityOutcome,
} from "./service-location"
import { loadServiceLocations } from "./service-location-providers"

// ============================================================================
// STOREFRONT SETTINGS
// ============================================================================

export type StoreAssignmentMode = "AUTO_ASSIGN_NEAREST" | "CUSTOMER_CHOICE"
export type ServiceabilityGate = "CHECKOUT" | "BROWSE"

export interface StorefrontSettings {
  storeAssignmentMode: StoreAssignmentMode
  allowCustomerStoreChoice: boolean
  serviceabilityMode: ServiceabilityGate
  deliveryRadiusFallbackKm: number
}

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  storeAssignmentMode: "AUTO_ASSIGN_NEAREST",
  allowCustomerStoreChoice: false,
  serviceabilityMode: "CHECKOUT",
  deliveryRadiusFallbackKm: 5,
}

/** Read the business's storefront settings, applying platform defaults. */
export async function getStorefrontSettings(businessId: string): Promise<StorefrontSettings> {
  if (!businessId) return DEFAULT_STOREFRONT_SETTINGS
  const s = await db.storefrontSettings.findUnique({ where: { businessId } })
  return {
    storeAssignmentMode: s?.storeAssignmentMode === "CUSTOMER_CHOICE" ? "CUSTOMER_CHOICE" : "AUTO_ASSIGN_NEAREST",
    allowCustomerStoreChoice: s?.allowCustomerStoreChoice ?? false,
    serviceabilityMode: s?.serviceabilityMode === "BROWSE" ? "BROWSE" : "CHECKOUT",
    deliveryRadiusFallbackKm: s?.deliveryRadiusFallbackKm && s.deliveryRadiusFallbackKm > 0
      ? s.deliveryRadiusFallbackKm
      : DEFAULT_STOREFRONT_SETTINGS.deliveryRadiusFallbackKm,
  }
}

// ============================================================================
// SERVICEABILITY
// ============================================================================

export interface AddressServiceabilityParams {
  businessId: string
  lat: number
  lng: number
  orderAmount?: number
}

export interface AddressServiceabilityResult {
  serviceable: boolean
  reason?: string
  nearestStoreId?: string
  nearestStoreName?: string
  locationKind?: string
  distance?: number
  deliveryFee?: number
  estimatedTime?: number
  freeDeliveryAbove?: number | null
  minOrderAmount?: number | null
  matchedZoneId?: string
  matchedZoneName?: string
}

function applyZoneOverrides(
  outcome: ServiceabilityOutcome,
  zones: Array<{ id: string; name: string; zoneType: string; centerLat: number | null; centerLng: number | null; radius: number | null; pincodes: string | null; deliveryFee: number; estimatedTime: number; freeDeliveryAbove: number | null; minOrderAmount: number }>,
  lat: number,
  lng: number,
  orderAmount?: number
): AddressServiceabilityResult {
  const nearest = outcome.nearest!
  let matchedZone: typeof zones[0] | null = null
  for (const zone of zones) {
    if (zone.zoneType === "CIRCLE" && zone.centerLat && zone.centerLng && zone.radius) {
      const d = haversineDistance(lat, lng, zone.centerLat, zone.centerLng)
      if (d <= zone.radius) { matchedZone = zone; break }
    } else if (zone.zoneType === "PINCODE" && zone.pincodes) {
      // Pincode zones are matched at order time when a pincode is resolved.
    }
  }

  let deliveryFee = nearest.deliveryFee
  let estimatedTime = nearest.preparationTime ?? undefined
  let freeDeliveryAbove = nearest.freeDeliveryAbove
  let minOrderAmount = nearest.minOrderAmount
  if (matchedZone) {
    if (matchedZone.deliveryFee > 0) deliveryFee = matchedZone.deliveryFee
    if (matchedZone.estimatedTime > 0) estimatedTime = matchedZone.estimatedTime
    if (matchedZone.freeDeliveryAbove) freeDeliveryAbove = matchedZone.freeDeliveryAbove
    if (matchedZone.minOrderAmount > 0) minOrderAmount = matchedZone.minOrderAmount
  }
  if (freeDeliveryAbove && orderAmount !== undefined && orderAmount >= freeDeliveryAbove) {
    deliveryFee = 0
  }

  return {
    serviceable: true,
    nearestStoreId: nearest.location.id,
    nearestStoreName: nearest.location.name,
    locationKind: nearest.location.kind,
    distance: nearest.distanceKm,
    deliveryFee,
    estimatedTime,
    freeDeliveryAbove,
    minOrderAmount,
    matchedZoneId: matchedZone?.id,
    matchedZoneName: matchedZone?.name,
  }
}

/**
 * Check whether an address (lat/lng) is serviceable for a business, across its
 * workspace's service locations, applying radius/min-order/zone rules.
 */
export async function checkAddressServiceability(
  params: AddressServiceabilityParams
): Promise<AddressServiceabilityResult> {
  const locations = await loadServiceLocations(params.businessId)
  const settings = await getStorefrontSettings(params.businessId)

  const outcome = evaluateServiceability(locations, params.lat, params.lng, {
    orderAmount: params.orderAmount,
    radiusFallbackKm: settings.deliveryRadiusFallbackKm,
  })

  if (!outcome.serviceable) {
    const nearest = outcome.nearest
    return {
      serviceable: false,
      reason: outcome.reason,
      nearestStoreId: nearest?.location.id,
      nearestStoreName: nearest?.location.name,
      locationKind: nearest?.location.kind,
      distance: nearest?.distanceKm,
      deliveryFee: nearest?.deliveryFee,
      freeDeliveryAbove: nearest?.freeDeliveryAbove ?? null,
      minOrderAmount: nearest?.minOrderAmount ?? null,
    }
  }

  const zones = await db.deliveryZone.findMany({
    where: { businessId: params.businessId, isActive: true },
  })

  return applyZoneOverrides(outcome, zones as never, params.lat, params.lng, params.orderAmount)
}

/**
 * List every ACTIVE service location for a business (used when the business
 * enables customer store choice). Returns the shared abstraction plus the
 * distance from the given address so the UI can sort by nearest.
 */
export async function listServiceLocationsWithDistance(
  businessId: string,
  lat: number,
  lng: number
): Promise<Array<ServiceLocation & { distanceKm: number | null; serviceable: boolean }>> {
  const locations = await loadServiceLocations(businessId)
  const settings = await getStorefrontSettings(businessId)

  return locations.map((loc) => {
    const d = haversineDistance(lat, lng, loc.latitude, loc.longitude)
    const rounded = Math.round(d * 10) / 10
    const radius =
      loc.serviceRadiusKm > 0
        ? loc.serviceRadiusKm
        : loc.maxDeliveryDistanceKm && loc.maxDeliveryDistanceKm > 0
          ? loc.maxDeliveryDistanceKm
          : settings.deliveryRadiusFallbackKm
    return { ...loc, distanceKm: rounded, serviceable: rounded <= radius }
  })
}
