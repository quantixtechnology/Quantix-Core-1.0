// ============================================================================
// QUANTIX CORE — Delivery & Pickup Architecture
// Haversine formula for distance, serviceability checks, nearest partner matching
// OTP verification, delivery fee calculation with surge, state machines
// Two workflows: Regular delivery (Grocery/Food) and Pickup & Delivery (Laundry/Car Wash)
// ============================================================================

import { db } from '@/lib/db';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Earth's radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Default delivery radius in km */
const DEFAULT_DELIVERY_RADIUS = 5;

/** Default city speed in km/h for ETA estimation */
const DEFAULT_CITY_SPEED_KMH = 20;

/** Buffer time in minutes for ETA */
const ETA_BUFFER_MINUTES = 5;

// ============================================================================
// TYPES
// ============================================================================

export type PickupDeliveryStatus =
  | 'PENDING'
  | 'PICKUP_ASSIGNED'
  | 'PICKED_UP'
  | 'PROCESSING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type RegularDeliveryStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface ServiceabilityResult {
  serviceable: boolean;
  nearestStoreId?: string;
  nearestStoreName?: string;
  distance?: number;
  deliveryFee?: number;
  estimatedTime?: number;
  freeDeliveryAbove?: number;
  minOrderAmount?: number;
  reason?: string;
  /** Delivery zone that matched (if any) */
  matchedZoneId?: string;
  matchedZoneName?: string;
}

export interface DeliveryFeeParams {
  distance: number; // km
  baseFee: number;
  freeDeliveryAbove?: number;
  orderAmount?: number;
  perKmRate?: number;
  surgeMultiplier?: number;
  minFee?: number;
  maxFee?: number;
}

export interface DeliveryPartnerResult {
  partnerId: string | null;
  partnerName: string | null;
  partnerPhone: string | null;
  distance: number | null;
  estimatedArrival: number | null; // minutes
}

// ============================================================================
// HAVERSINE FORMULA — Distance between two GPS coordinates
// ============================================================================

/**
 * Calculate the great-circle distance between two GPS points using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================================================
// SERVICEABILITY CHECK — Can this address be served?
// ============================================================================

/**
 * Check if a delivery address is within service range of any store.
 * Uses Haversine formula to find the nearest store.
 * Also checks delivery zones for the business.
 * Returns delivery fee, estimated time, and min order amount.
 */
export async function checkServiceability(params: {
  businessId: string;
  deliveryLat: number;
  deliveryLng: number;
  orderAmount?: number;
}): Promise<ServiceabilityResult> {
  // Get all active stores for this business
  const stores = await db.store.findMany({
    where: {
      businessId: params.businessId,
      status: 'ACTIVE',
    },
  });

  if (stores.length === 0) {
    return {
      serviceable: false,
      reason: 'No active stores found for this business',
    };
  }

  // Find nearest store by Haversine distance
  let nearestStore: typeof stores[0] | null = null;
  let nearestDistance = Infinity;

  for (const store of stores) {
    if (!store.latitude || !store.longitude) continue;

    const distance = haversineDistance(
      params.deliveryLat,
      params.deliveryLng,
      store.latitude,
      store.longitude
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStore = store;
    }
  }

  if (!nearestStore) {
    return {
      serviceable: false,
      reason: 'No stores with location data available',
    };
  }

  const deliveryRadius = nearestStore.deliveryRadius || DEFAULT_DELIVERY_RADIUS;
  const maxDeliveryDistance = nearestStore.maxDeliveryDistance || deliveryRadius;

  // Check if within delivery radius
  if (nearestDistance > maxDeliveryDistance) {
    return {
      serviceable: false,
      nearestStoreId: nearestStore.id,
      nearestStoreName: nearestStore.name,
      distance: Math.round(nearestDistance * 10) / 10,
      reason: `Location is ${nearestDistance.toFixed(1)}km away — outside the ${maxDeliveryDistance}km delivery radius`,
    };
  }

  // Check minimum order amount
  if (params.orderAmount && nearestStore.minOrderAmount && params.orderAmount < nearestStore.minOrderAmount) {
    return {
      serviceable: false,
      nearestStoreId: nearestStore.id,
      nearestStoreName: nearestStore.name,
      distance: Math.round(nearestDistance * 10) / 10,
      minOrderAmount: nearestStore.minOrderAmount,
      reason: `Minimum order amount is ₹${nearestStore.minOrderAmount}`,
    };
  }

  // Check delivery zones for more specific rules
  const zones = await db.deliveryZone.findMany({
    where: {
      businessId: params.businessId,
      isActive: true,
    },
  });

  let matchedZone: typeof zones[0] | null = null;
  for (const zone of zones) {
    if (zone.zoneType === 'CIRCLE' && zone.centerLat && zone.centerLng && zone.radius) {
      const distToZone = haversineDistance(
        params.deliveryLat,
        params.deliveryLng,
        zone.centerLat,
        zone.centerLng
      );
      if (distToZone <= zone.radius) {
        matchedZone = zone;
        break;
      }
    } else if (zone.zoneType === 'PINCODE' && zone.pincodes) {
      // Pincode-based zone check — would need reverse geocoding in production
      // For now, skip pincode zones in this check
    }
  }

  // Determine delivery fee and estimated time
  let deliveryFee = nearestStore.deliveryFee;
  let estimatedTime = nearestStore.preparationTime;
  let freeDeliveryAbove = nearestStore.freeDeliveryAbove;
  let minOrderAmount = nearestStore.minOrderAmount;

  // Override with zone-specific settings if matched
  if (matchedZone) {
    if (matchedZone.deliveryFee > 0) deliveryFee = matchedZone.deliveryFee;
    if (matchedZone.estimatedTime > 0) estimatedTime = matchedZone.estimatedTime;
    if (matchedZone.freeDeliveryAbove) freeDeliveryAbove = matchedZone.freeDeliveryAbove;
    if (matchedZone.minOrderAmount > 0) minOrderAmount = matchedZone.minOrderAmount;
  }

  // Free delivery if order amount exceeds threshold
  if (freeDeliveryAbove && params.orderAmount && params.orderAmount >= freeDeliveryAbove) {
    deliveryFee = 0;
  }

  return {
    serviceable: true,
    nearestStoreId: nearestStore.id,
    nearestStoreName: nearestStore.name,
    distance: Math.round(nearestDistance * 10) / 10,
    deliveryFee,
    estimatedTime,
    freeDeliveryAbove,
    minOrderAmount,
    matchedZoneId: matchedZone?.id,
    matchedZoneName: matchedZone?.name,
  };
}

// ============================================================================
// DELIVERY PARTNER ASSIGNMENT — Nearest available partner
// ============================================================================

/**
 * Find the nearest available (online, active) delivery partner for a business.
 * Uses Haversine distance from pickup point to partner's current location.
 */
export async function findNearestDeliveryPartner(params: {
  businessId: string;
  pickupLat: number;
  pickupLng: number;
}): Promise<DeliveryPartnerResult> {
  const partners = await db.deliveryPartner.findMany({
    where: {
      businessId: params.businessId,
      isActive: true,
      isOnline: true,
      currentLat: { not: null },
      currentLng: { not: null },
    },
  });

  if (partners.length === 0) {
    return { partnerId: null, partnerName: null, partnerPhone: null, distance: null, estimatedArrival: null };
  }

  let nearestPartner: typeof partners[0] | null = null;
  let nearestDistance = Infinity;

  for (const partner of partners) {
    if (!partner.currentLat || !partner.currentLng) continue;

    const distance = haversineDistance(
      params.pickupLat,
      params.pickupLng,
      partner.currentLat,
      partner.currentLng
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPartner = partner;
    }
  }

  if (!nearestPartner) {
    return { partnerId: null, partnerName: null, partnerPhone: null, distance: null, estimatedArrival: null };
  }

  // Estimate arrival: average speed in city + buffer
  const estimatedMinutes = Math.ceil((nearestDistance / DEFAULT_CITY_SPEED_KMH) * 60) + ETA_BUFFER_MINUTES;

  return {
    partnerId: nearestPartner.id,
    partnerName: nearestPartner.name,
    partnerPhone: nearestPartner.phone,
    distance: Math.round(nearestDistance * 10) / 10,
    estimatedArrival: estimatedMinutes,
  };
}

// ============================================================================
// OTP GENERATION & VERIFICATION
// ============================================================================

/**
 * Generate a 4-digit OTP for delivery/pickup verification.
 */
export function generateDeliveryOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Verify a delivery/pickup OTP by simple comparison.
 */
export function verifyOtp(expected: string, provided: string): boolean {
  return expected === provided;
}

// ============================================================================
// DELIVERY FEE CALCULATION
// ============================================================================

/**
 * Calculate delivery fee based on distance and store configuration.
 * Formula: baseFee + (distance × perKmRate) × surgeMultiplier
 * Respects min/max fee bounds and free delivery thresholds.
 */
export function calculateDeliveryFee(params: DeliveryFeeParams): number {
  // Free delivery above threshold
  if (params.freeDeliveryAbove && params.orderAmount && params.orderAmount >= params.freeDeliveryAbove) {
    return 0;
  }

  const perKmRate = params.perKmRate || 5; // ₹5/km default
  const surgeMultiplier = params.surgeMultiplier || 1;

  let fee = (params.baseFee + (params.distance * perKmRate)) * surgeMultiplier;

  // Apply min/max bounds
  if (params.minFee !== undefined && fee < params.minFee) {
    fee = params.minFee;
  }
  if (params.maxFee !== undefined && fee > params.maxFee) {
    fee = params.maxFee;
  }

  return Math.round(fee * 100) / 100;
}

// ============================================================================
// PICKUP & DELIVERY STATE MACHINE
// For LAUNDRY, CAR_WASH (pickup), HOME_SERVICES
//
// Flow: PENDING → PICKUP_ASSIGNED → PICKED_UP → PROCESSING →
//       READY_FOR_DELIVERY → OUT_FOR_DELIVERY → DELIVERED
//       (any → CANCELLED)
// ============================================================================

const PICKUP_DELIVERY_TRANSITIONS: Record<PickupDeliveryStatus, PickupDeliveryStatus[]> = {
  PENDING: ['PICKUP_ASSIGNED', 'CANCELLED'],
  PICKUP_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Validate a status transition for pickup & delivery orders.
 */
export function isValidPickupDeliveryTransition(
  current: PickupDeliveryStatus,
  next: PickupDeliveryStatus
): boolean {
  const allowed = PICKUP_DELIVERY_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

// ============================================================================
// REGULAR DELIVERY STATE MACHINE
// For GROCERY, FOOD_DELIVERY, PHARMACY, MEAT_DELIVERY, ECOMMERCE
//
// Flow: PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP →
//       OUT_FOR_DELIVERY → DELIVERED
//       (any → CANCELLED)
// ============================================================================

const REGULAR_DELIVERY_TRANSITIONS: Record<RegularDeliveryStatus, RegularDeliveryStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Validate a status transition for regular delivery orders.
 */
export function isValidRegularDeliveryTransition(
  current: RegularDeliveryStatus,
  next: RegularDeliveryStatus
): boolean {
  const allowed = REGULAR_DELIVERY_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

// ============================================================================
// UNIFIED STATUS TRANSITION QUERY
// ============================================================================

/**
 * Get the valid next statuses for an order based on its current status and type.
 */
export function getValidNextStatuses(
  currentStatus: string,
  orderType: string
): string[] {
  if (orderType === 'PICKUP_AND_DELIVERY') {
    const transitions = PICKUP_DELIVERY_TRANSITIONS[currentStatus as PickupDeliveryStatus];
    return transitions || [];
  }
  const transitions = REGULAR_DELIVERY_TRANSITIONS[currentStatus as RegularDeliveryStatus];
  return transitions || [];
}

// ============================================================================
// PICKUP & DELIVERY ORDER TRANSITION — With OTP verification
// ============================================================================

/**
 * Process a status transition for a pickup & delivery order.
 * Validates the transition, verifies OTP when required, and records history.
 */
export async function transitionPickupDeliveryOrder(params: {
  orderId: string;
  businessId: string;
  newStatus: PickupDeliveryStatus;
  changedBy: string;
  pickupOtp?: string;
  deliveryOtp?: string;
  pickupPartnerId?: string;
  deliveryPartnerId?: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const order = await db.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
  });

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.orderType !== 'PICKUP_AND_DELIVERY') {
    return { success: false, error: 'Order is not a pickup & delivery order' };
  }

  const currentStatus = order.status as PickupDeliveryStatus;

  if (!isValidPickupDeliveryTransition(currentStatus, params.newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${params.newStatus}`,
    };
  }

  const updateData: Record<string, unknown> = {
    status: params.newStatus,
  };

  // Handle specific transitions with side effects
  switch (params.newStatus) {
    case 'PICKUP_ASSIGNED':
      if (params.pickupPartnerId) {
        updateData.pickupPartnerId = params.pickupPartnerId;
        updateData.pickupOtp = generateDeliveryOtp();
      }
      break;

    case 'PICKED_UP':
      // Verify pickup OTP if set
      if (order.pickupOtp && !verifyOtp(order.pickupOtp, params.pickupOtp || '')) {
        return { success: false, error: 'Invalid pickup OTP' };
      }
      updateData.pickupCompletedAt = new Date();
      break;

    case 'PROCESSING':
      // Items are being processed (e.g., laundry being washed)
      break;

    case 'READY_FOR_DELIVERY':
      // Items ready, assign delivery partner if provided
      if (params.deliveryPartnerId) {
        updateData.deliveryPartnerId = params.deliveryPartnerId;
        updateData.deliveryOtp = generateDeliveryOtp();
      }
      break;

    case 'OUT_FOR_DELIVERY':
      // Delivery partner is on the way
      break;

    case 'DELIVERED':
      // Verify delivery OTP if set
      if (order.deliveryOtp && !verifyOtp(order.deliveryOtp, params.deliveryOtp || '')) {
        return { success: false, error: 'Invalid delivery OTP' };
      }
      updateData.deliveredAt = new Date();
      break;

    case 'CANCELLED':
      updateData.cancelledAt = new Date();
      if (params.note) {
        updateData.cancelReason = params.note;
      }
      break;
  }

  // Update order
  await db.order.update({
    where: { id: params.orderId },
    data: updateData,
  });

  // Record status history
  await db.orderStatusHistory.create({
    data: {
      orderId: params.orderId,
      status: params.newStatus as typeof order.status,
      note: params.note || `Transitioned from ${currentStatus} to ${params.newStatus}`,
      changedBy: params.changedBy,
    },
  });

  return { success: true };
}
