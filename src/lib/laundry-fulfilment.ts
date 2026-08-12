// Laundry fulfilment — the four real combinations, in one place.
//
// An order may need pickup, delivery, both or neither. That is the whole model:
// there is no Pickup Order, no Delivery Order, no Store Order. The two booleans
// live on LaundryOrder already (pickupRequired / deliveryRequired) alongside the
// existing pickup/delivery date + slot fields, so nothing new is stored and no
// second scheduling mechanism exists.
//
//   pickup  delivery
//    No       No      customer drops off and collects — nothing to schedule
//    No       Yes     garments are already at the store; schedule delivery only
//    Yes      No      garments are still with the customer; schedule pickup only
//    Yes      Yes     schedule both, independently
//
// This module is deliberately pure: no Prisma, no fetch, no React. It decides
// what to ask for and what to send, and nothing else.

export interface FulfilmentState {
  pickupRequired: boolean
  deliveryRequired: boolean
  /** Resolved from the customer's SAVED addresses — never retyped. */
  addressText: string
  addressId?: string | null
  landmark?: string | null
  lat?: number | null
  lng?: number | null
  pickupDate: string
  pickupTimeSlot: string
  deliveryDate: string
  deliveryTimeSlot: string
}

/** An address is needed only when someone has to travel to it. */
export const needsAddress = (s: Pick<FulfilmentState, "pickupRequired" | "deliveryRequired">): boolean =>
  s.pickupRequired || s.deliveryRequired

/**
 * Order type is DERIVED, never asked.
 *
 * Pickup Required = Yes IS the home pickup, and the order engine reads it to
 * start the order awaiting pickup rather than at Store Audit — garments the
 * customer has not handed over are not at the store. Everything else is the
 * counter walk-in. The old CORPORATE / SUBSCRIPTION choices resolved to the
 * walk-in minimum and matched no separate pricing rule, so they changed no price
 * and are simply gone.
 */
export const orderTypeFor = (pickupRequired: boolean): string => (pickupRequired ? "HOME_PICKUP" : "WALK_IN")

/**
 * Minimal validation: a leg that is switched off is never validated.
 * Returns the first problem in the operator's reading order, or null.
 */
export function fulfilmentError(s: FulfilmentState): string | null {
  if (needsAddress(s) && !s.addressText.trim()) return "Select the customer's address for this order."
  if (s.pickupRequired && !s.pickupDate) return "Select a pickup date."
  if (s.pickupRequired && !s.pickupTimeSlot) return "Select a pickup time slot."
  if (s.deliveryRequired && !s.deliveryDate) return "Select a delivery date."
  if (s.deliveryRequired && !s.deliveryTimeSlot) return "Select a delivery time slot."
  return null
}

export interface FulfilmentPayload {
  orderType: string
  pickupRequired: boolean
  deliveryRequired: boolean
  pickupDate: string | null
  pickupTimeSlot: string | null
  deliveryDate: string | null
  deliveryTimeSlot: string | null
  pickupAddress: string | null
  pickupAddressId: string | null
  pickupLandmark: string | null
  pickupLat: number | null
  pickupLng: number | null
}

/**
 * Exactly the fields the order needs — a switched-off leg contributes nulls, so
 * a walk-in never carries a stale pickup date from a toggle the operator changed
 * their mind about.
 *
 * The address goes to the pickupAddress* fields for BOTH legs because that is
 * the one address a LaundryOrder holds, and the delivery job already reads it
 * (see /api/laundry/executive/jobs — `address: o.pickupAddress` for pickup and
 * delivery alike). Sending it on a delivery-only order is what finally gives the
 * delivery executive somewhere to go.
 */
export function fulfilmentPayload(s: FulfilmentState): FulfilmentPayload {
  const withAddress = needsAddress(s)
  return {
    orderType: orderTypeFor(s.pickupRequired),
    pickupRequired: s.pickupRequired,
    deliveryRequired: s.deliveryRequired,
    pickupDate: s.pickupRequired ? s.pickupDate || null : null,
    pickupTimeSlot: s.pickupRequired ? s.pickupTimeSlot || null : null,
    deliveryDate: s.deliveryRequired ? s.deliveryDate || null : null,
    deliveryTimeSlot: s.deliveryRequired ? s.deliveryTimeSlot || null : null,
    pickupAddress: withAddress ? s.addressText.trim() || null : null,
    pickupAddressId: withAddress ? s.addressId || null : null,
    pickupLandmark: withAddress ? s.landmark || null : null,
    pickupLat: withAddress ? s.lat ?? null : null,
    pickupLng: withAddress ? s.lng ?? null : null,
  }
}

/** Heading for the single address block, so it never says "Pickup Address" on a
 *  delivery-only order. */
export function addressLabel(s: Pick<FulfilmentState, "pickupRequired" | "deliveryRequired">): string {
  if (s.pickupRequired && s.deliveryRequired) return "Pickup & Delivery Address"
  if (s.pickupRequired) return "Pickup Address"
  return "Delivery Address"
}
