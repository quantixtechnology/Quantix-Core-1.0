// ============================================================================
// PICKUP LOCATION — does the address about to be booked have a point on the map?
//
// A laundry pickup is assigned to a store by MEASURING the distance from the
// pickup address to every store's CURRENT location (resolveLaundryStoreForPickup
// → checkAddressServiceability). An address carrying no latitude/longitude
// cannot be measured, so the server refuses it with a 422. That refusal is
// correct and stays: serviceability is never granted to an address that cannot
// be placed on the map, and history never grants an exception.
//
// The storefront, though, treated the map pin as an optional convenience:
//
//   • An address saved from typed text alone carries no coordinates, renders
//     identically to a pinned one in the saved-address list, and fails only
//     after the customer has filled in nine fields and pressed Confirm.
//   • A customer who DID drop a pin had the coordinates dropped anyway — the
//     inline pickup payload was built field-by-field and never copied them
//     across, so a correctly pinned address reached the server as text.
//
// This module is that one rule, kept pure so it can be tested without a
// browser: WHICH address is actually being booked, does it carry a usable
// point, and what must the inline payload carry for the server to see it.
//
// Nothing here geocodes or guesses. An address without a pin is reported as
// such, never repaired by inference — inventing a coordinate would re-create
// the exact defect the server-side guard exists to prevent.
// ============================================================================

import type { StructuredAddress } from "@/lib/laundry-address"

/** Shown when the address being booked has no point on the map. */
export const PICKUP_LOCATION_REQUIRED =
  'Set the exact location on the map to enable pickup — tap "Choose on map".'

/**
 * Shown for a SAVED address with no point. It names the recovery path, which is
 * different from the inline one: this sheet has no per-address editor, so the
 * customer re-adds the address with the picker rather than editing it in place.
 */
export const SAVED_PICKUP_LOCATION_REQUIRED =
  'This saved address has no map location. Add it again with "Choose on map" to enable pickup.'

/** Badge on a saved address the serviceability engine could not measure. */
export const UNPINNED_ADDRESS_BADGE = "Location not set"

export interface PickupCoordinates {
  latitude?: number | null
  longitude?: number | null
}

export interface SavedPickupAddress extends PickupCoordinates {
  id: string
}

/**
 * A coordinate pair the serviceability engine can actually measure.
 *
 * Deliberately the SAME test the server applies (`lat == null || Number.isNaN`)
 * and the same one the sibling laundry checkout already applies client-side —
 * a client gate that is stricter than the server would block bookings the
 * server would have accepted, and a looser one would let the 422 through again.
 * So: finite numbers only. No range check, no Null-Island rule, no coercion of
 * numeric strings — an out-of-range or mid-ocean point is a SERVICE-AREA
 * question, and the server answers it with the distance and the nearest store.
 */
export function hasValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
}

/**
 * Which address supplies the pickup point.
 * - `saved`   — a saved address is selected; its stored coordinates decide.
 * - `inline`  — no saved address selected; the form the customer is filling in
 *               decides (it is either persisted first, or sent as `structured`).
 * - `unknown` — an id is selected that is not in the loaded list.
 */
export type PickupAddressSource = "saved" | "inline" | "unknown"

export interface PickupLocationVerdict {
  ok: boolean
  source: PickupAddressSource
  latitude: number | null
  longitude: number | null
  /** Customer-facing message when `ok` is false. */
  reason?: string
}

/**
 * Resolve the point the pickup will actually be booked against.
 *
 * The selected saved address wins whenever one is selected — that is exactly
 * what submit() sends as `addressId`, and the server then reads the coordinates
 * from the ADDRESS ROW, never from the form. Checking the form in that case
 * would validate a value the server is not going to look at.
 *
 * A selected id that is not in the loaded list is reported `unknown` and passes
 * (`ok: true`). We cannot verify it locally, and blocking on a list that has
 * not loaded would refuse a perfectly good address. The server stays the final
 * safety net for that case — which is the one thing it is guaranteed to catch.
 */
export function resolvePickupLocation(input: {
  selectedAddressId?: string | null
  addresses?: readonly SavedPickupAddress[] | null
  form?: PickupCoordinates | null
}): PickupLocationVerdict {
  const { selectedAddressId, addresses, form } = input

  if (selectedAddressId) {
    const saved = (addresses || []).find((a) => a.id === selectedAddressId)
    if (!saved) {
      return { ok: true, source: "unknown", latitude: null, longitude: null }
    }
    const ok = hasValidCoordinates(saved.latitude, saved.longitude)
    return {
      ok,
      source: "saved",
      latitude: ok ? (saved.latitude as number) : null,
      longitude: ok ? (saved.longitude as number) : null,
      ...(ok ? {} : { reason: SAVED_PICKUP_LOCATION_REQUIRED }),
    }
  }

  const ok = hasValidCoordinates(form?.latitude, form?.longitude)
  return {
    ok,
    source: "inline",
    latitude: ok ? (form?.latitude as number) : null,
    longitude: ok ? (form?.longitude as number) : null,
    ...(ok ? {} : { reason: PICKUP_LOCATION_REQUIRED }),
  }
}

/**
 * True when a saved address should be flagged as unpinned in the list.
 *
 * The parameter is deliberately permissive: the case this guards against is an
 * address object whose coordinate keys were dropped somewhere between the API
 * and the render, so an object that does not declare them at all is exactly
 * what must be accepted here — and reported as unpinned.
 */
export function isUnpinnedAddress(
  address: { latitude?: unknown; longitude?: unknown } | null | undefined,
): boolean {
  return !hasValidCoordinates(address?.latitude, address?.longitude)
}

export interface PickupAddressForm extends PickupCoordinates {
  label?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  area?: string | null
  landmark?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  googlePlaceId?: string | null
  formattedAddress?: string | null
}

/**
 * Build the inline (`structured`) pickup address the order APIs accept.
 *
 * The return type is the server's own `StructuredAddress`, so a field the
 * server reads can never silently go missing here again: the coordinates and
 * the Google identifiers travel with the text, because `resolvePickupAddress`
 * reads all four off this object and `resolveLaundryStoreForPickup` measures
 * the first two. Building this by hand at the call site is what dropped them.
 */
export function buildStructuredPickupAddress(
  form: PickupAddressForm,
  identity?: { fullName?: string | null; phone?: string | null },
): StructuredAddress {
  return {
    fullName: identity?.fullName ?? null,
    phone: identity?.phone ?? null,
    label: form.label ?? null,
    addressLine1: form.addressLine1 ?? null,
    addressLine2: form.addressLine2 ?? null,
    area: form.area ?? null,
    landmark: form.landmark ?? null,
    city: form.city ?? null,
    state: form.state ?? null,
    pincode: form.pincode ?? null,
    latitude: form.latitude ?? null,
    longitude: form.longitude ?? null,
    googlePlaceId: form.googlePlaceId ?? null,
    formattedAddress: form.formattedAddress ?? null,
  }
}
