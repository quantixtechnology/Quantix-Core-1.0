// ============================================================================
// Quantix Technology — Delivery & Pickup Architecture
// Haversine Formula for serviceability, nearest store matching, OTP verification
// Two-phase delivery: Pickup → Processing → Delivery (for Laundry etc.)
// ============================================================================

import { db } from './db';
import type { OrderType, OrderStatus, DeliveryStatus } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Earth's radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Default delivery radius in km */
const DEFAULT_DELIVERY_RADIUS = 5;

// ============================================================================
// HAVERSINE FORMULA — Distance between two GPS coordinates
// ============================================================================

/**
 * Calculate the distance between two GPS points using the Haversine formula.
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
}

/**
 * Check if a delivery address is within service range of any store.
 * Uses Haversine formula to find the nearest store.
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

  // Check if within delivery radius
  if (nearestDistance > deliveryRadius) {
    return {
      serviceable: false,
      nearestStoreId: nearestStore.id,
      nearestStoreName: nearestStore.name,
      distance: Math.round(nearestDistance * 10) / 10,
      reason: `Location is ${nearestDistance.toFixed(1)}km away — outside the ${deliveryRadius}km delivery radius`,
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

  return {
    serviceable: true,
    nearestStoreId: nearestStore.id,
    nearestStoreName: nearestStore.name,
    distance: Math.round(nearestDistance * 10) / 10,
    deliveryFee: nearestStore.deliveryFee,
    estimatedTime: nearestStore.preparationTime,
    freeDeliveryAbove: nearestStore.freeDeliveryAbove,
    minOrderAmount: nearestStore.minOrderAmount,
  };
}

// ============================================================================
// DELIVERY PARTNER ASSIGNMENT — Nearest available partner
// ============================================================================

/**
 * Find the nearest available delivery partner for a business.
 */
export async function findNearestDeliveryPartner(params: {
  businessId: string;
  pickupLat: number;
  pickupLng: number;
}): Promise<{
  partnerId: string | null;
  partnerName: string | null;
  distance: number | null;
  estimatedArrival: number | null; // minutes
}> {
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
    return { partnerId: null, partnerName: null, distance: null, estimatedArrival: null };
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
    return { partnerId: null, partnerName: null, distance: null, estimatedArrival: null };
  }

  // Estimate arrival: average speed 20km/h in city
  const estimatedMinutes = Math.ceil((nearestDistance / 20) * 60) + 5; // +5 min buffer

  return {
    partnerId: nearestPartner.id,
    partnerName: nearestPartner.name,
    distance: Math.round(nearestDistance * 10) / 10,
    estimatedArrival: estimatedMinutes,
  };
}

// ============================================================================
// OTP GENERATION — For delivery and pickup verification
// ============================================================================

/**
 * Generate a 4-digit OTP for delivery/pickup verification.
 */
export function generateDeliveryOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Verify a delivery/pickup OTP.
 */
export function verifyOtp(expectedOtp: string, providedOtp: string): boolean {
  return expectedOtp === providedOtp;
}

// ============================================================================
// PICKUP & DELIVERY WORKFLOW — State Machine
// For LAUNDRY, CAR_WASH (pickup), HOME_SERVICES
//
// State Flow:
//   PICKUP_ASSIGNED → PICKED_UP (OTP verified) → PROCESSING →
//   READY_FOR_DELIVERY → OUT_FOR_DELIVERY → DELIVERED (OTP verified)
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

/**
 * Valid state transitions for pickup & delivery orders.
 */
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
  currentStatus: PickupDeliveryStatus,
  newStatus: PickupDeliveryStatus
): boolean {
  const allowed = PICKUP_DELIVERY_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
}

/**
 * Process a status transition for a pickup & delivery order.
 * Returns error if transition is invalid.
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

  // Handle specific transitions
  switch (params.newStatus) {
    case 'PICKUP_ASSIGNED':
      if (params.pickupPartnerId) {
        updateData.pickupPartnerId = params.pickupPartnerId;
        updateData.pickupOtp = generateDeliveryOtp();
      }
      break;

    case 'PICKED_UP':
      // Verify pickup OTP
      if (order.pickupOtp && params.pickupOtp !== order.pickupOtp) {
        return { success: false, error: 'Invalid pickup OTP' };
      }
      updateData.pickupCompletedAt = new Date();
      break;

    case 'PROCESSING':
      // Items are now being processed (e.g., laundry being washed)
      break;

    case 'READY_FOR_DELIVERY':
      // Items ready, assign delivery partner
      if (params.deliveryPartnerId) {
        updateData.deliveryPartnerId = params.deliveryPartnerId;
        updateData.deliveryOtp = generateDeliveryOtp();
      }
      break;

    case 'OUT_FOR_DELIVERY':
      // Delivery partner is on the way
      break;

    case 'DELIVERED':
      // Verify delivery OTP
      if (order.deliveryOtp && params.deliveryOtp !== order.deliveryOtp) {
        return { success: false, error: 'Invalid delivery OTP' };
      }
      updateData.deliveredAt = new Date();
      break;

    case 'CANCELLED':
      updateData.cancelledAt = new Date();
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
      status: params.newStatus as OrderStatus,
      note: `Transitioned from ${currentStatus}`,
      changedBy: params.changedBy,
    },
  });

  return { success: true };
}

// ============================================================================
// REGULAR DELIVERY WORKFLOW — State Machine
// For GROCERY, FOOD_DELIVERY, PHARMACY, MEAT_DELIVERY, ECOMMERCE etc.
//
// State Flow:
//   CONFIRMED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED
// ============================================================================

export type RegularDeliveryStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

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
  currentStatus: RegularDeliveryStatus,
  newStatus: RegularDeliveryStatus
): boolean {
  const allowed = REGULAR_DELIVERY_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
}

/**
 * Get the valid next statuses for an order based on its current status and type.
 */
export function getValidNextStatuses(
  currentStatus: string,
  orderType: OrderType
): string[] {
  if (orderType === 'PICKUP_AND_DELIVERY') {
    const transitions = PICKUP_DELIVERY_TRANSITIONS[currentStatus as PickupDeliveryStatus];
    return transitions || [];
  }
  const transitions = REGULAR_DELIVERY_TRANSITIONS[currentStatus as RegularDeliveryStatus];
  return transitions || [];
}

// ============================================================================
// DELIVERY FEE CALCULATION
// ============================================================================

export interface DeliveryFeeParams {
  distance: number; // km
  baseFee: number;
  freeDeliveryAbove?: number;
  perKmRate?: number;
  surgeMultiplier?: number;
}

/**
 * Calculate delivery fee based on distance and store configuration.
 */
export function calculateDeliveryFee(params: DeliveryFeeParams): number {
  // Free delivery above threshold
  if (params.freeDeliveryAbove) {
    // The caller should check order amount against freeDeliveryAbove
    // This function calculates the fee based on distance only
  }

  const perKmRate = params.perKmRate || 5; // ₹5/km default
  const distanceFee = params.baseFee + (params.distance * perKmRate);
  const surgeMultiplier = params.surgeMultiplier || 1;

  return Math.round(distanceFee * surgeMultiplier * 100) / 100;
}
