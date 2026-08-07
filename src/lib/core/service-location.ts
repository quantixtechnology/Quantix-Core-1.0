// ============================================================================
// QUANTIX CORE — Service Location Abstraction
//
// A PLATFORM capability, not a workspace feature. Any workspace — Laundry,
// Commerce, Grocery, Pharmacy, Food, Flowers, Electronics, Car Wash, Salon,
// Pet Care — plugs its own service locations into this ONE engine via
// `ServiceLocation` rows. The engine itself contains ZERO workspace-specific
// logic: it only needs
//
//     Service Locations  →  Customer Address  →  Business Rules
//                                             →  Nearest Eligible Service Location
//
// The pure functions below are DB-free and intentionally side-effect free so
// they can be unit-tested in isolation and reused by every current and future
// workspace without modification.
// ============================================================================

// ============================================================================
// GEOMETRY — Haversine great-circle distance (canonical platform implementation).
// Re-exported by `delivery.ts` for backward compatibility with existing callers.
// ============================================================================

export const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

// ============================================================================
// TYPES
// ============================================================================

/** A customer-facing service location. Every workspace maps its store table here. */
export interface ServiceLocation {
  id: string
  businessId: string
  /** Workspace location table this came from — "store" | "laundryStore" | future. */
  kind: string
  name: string
  latitude: number
  longitude: number
  /** Primary service radius in km (from the workspace's own config). */
  serviceRadiusKm: number
  /** Optional pickup radius in km, when the workspace distinguishes pickup. */
  pickupRadiusKm?: number
  /** Default map zoom used when centering the map on this location. */
  defaultMapZoom?: number
  /** Google Place ID of the location, when the workspace persists one. */
  googlePlaceId?: string | null
  /** Optional hard cap on distance, if the workspace defines one separately. */
  maxDeliveryDistanceKm?: number | null
  isActive: boolean
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  deliveryFee?: number
  freeDeliveryAbove?: number | null
  minOrderAmount?: number | null
  preparationTime?: number | null
  /** Open/closed override: "AUTOMATIC" | "FORCE_OPEN" | "FORCE_CLOSED". */
  statusOverride?: "AUTOMATIC" | "FORCE_OPEN" | "FORCE_CLOSED" | null
  /** Per-location weekly schedule override: { day, openTime, closeTime, isClosed }[]. */
  businessHoursOverride?: string | null
}

/** Business rules applied by the engine — all optional, workspace-agnostic. */
export interface ServiceabilityRules {
  /** Cart total — used for min-order + free-delivery threshold evaluation. */
  orderAmount?: number
  /** Radius fallback when a location defines no radius. */
  radiusFallbackKm?: number
}

export interface NearestLocationResult {
  location: ServiceLocation | null
  distanceKm: number | null
}

export interface NearestLocationEligible extends NearestLocationResult {
  location: ServiceLocation
  distanceKm: number
  deliveryFee: number
  freeDeliveryAbove: number | null
  minOrderAmount: number | null
  preparationTime: number | null
}

export interface ServiceabilityOutcome {
  serviceable: boolean
  nearest?: NearestLocationEligible
  reason?: string
}

// ============================================================================
// PURE CORE
// ============================================================================

/**
 * Find the nearest ACTIVE, coordinate-bearing service location to an address.
 * Pure — no database, no workspace logic.
 */
export function findNearestServiceLocation(
  locations: ServiceLocation[],
  lat: number,
  lng: number
): NearestLocationResult {
  let nearest: ServiceLocation | null = null
  let nearestDistance = Infinity

  for (const loc of locations) {
    if (!loc.isActive) continue
    if (typeof loc.latitude !== "number" || typeof loc.longitude !== "number") continue
    if (Number.isNaN(loc.latitude) || Number.isNaN(loc.longitude)) continue
    const d = haversineDistance(lat, lng, loc.latitude, loc.longitude)
    if (d < nearestDistance) {
      nearestDistance = d
      nearest = loc
    }
  }

  return {
    location: nearest,
    distanceKm: nearest === null ? null : Math.round(nearestDistance * 10) / 10,
  }
}

function toEligible(
  location: ServiceLocation,
  distanceKm: number,
  rules: ServiceabilityRules
): NearestLocationEligible {
  let deliveryFee = location.deliveryFee ?? 0
  if (location.freeDeliveryAbove && rules.orderAmount && rules.orderAmount >= location.freeDeliveryAbove) {
    deliveryFee = 0
  }
  return {
    location,
    distanceKm,
    deliveryFee,
    freeDeliveryAbove: location.freeDeliveryAbove ?? null,
    minOrderAmount: location.minOrderAmount ?? null,
    preparationTime: location.preparationTime ?? null,
  }
}

/**
 * Evaluate whether an address is serviceable across the given locations.
 * Pure — applies ONLY the rules (radius, min order, free-delivery threshold).
 */
export function evaluateServiceability(
  locations: ServiceLocation[],
  lat: number,
  lng: number,
  rules: ServiceabilityRules = {}
): ServiceabilityOutcome {
  if (!locations || locations.length === 0) {
    return { serviceable: false, reason: "No service locations configured for this business" }
  }

  const { location, distanceKm } = findNearestServiceLocation(locations, lat, lng)
  if (!location || distanceKm === null) {
    return { serviceable: false, reason: "No service location with location data available" }
  }

  const radius =
    location.serviceRadiusKm > 0
      ? location.serviceRadiusKm
      : location.maxDeliveryDistanceKm && location.maxDeliveryDistanceKm > 0
        ? location.maxDeliveryDistanceKm
        : rules.radiusFallbackKm || 5

  if (distanceKm > radius) {
    return {
      serviceable: false,
      nearest: toEligible(location, distanceKm, rules),
      reason: `This address is ${distanceKm.toFixed(1)} km away — outside the ${radius.toFixed(1)} km service radius`,
    }
  }

  if (rules.orderAmount !== undefined && location.minOrderAmount && rules.orderAmount < location.minOrderAmount) {
    return {
      serviceable: false,
      nearest: toEligible(location, distanceKm, rules),
      reason: `Minimum order amount is ₹${location.minOrderAmount}`,
    }
  }

  return {
    serviceable: true,
    nearest: toEligible(location, distanceKm, rules),
  }
}
