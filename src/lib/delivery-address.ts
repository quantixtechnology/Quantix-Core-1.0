import type { DeliveryAddress } from "@/stores/cart-store"

// ============================================================================
// Delivery address helpers shared by the storefront header, address sheet and
// checkout. Pure formatting + Google Place → DeliveryAddress mapping.
// ============================================================================

/** "Area, City - Pincode" one-liner for list rows. */
export function formatAddressLine(a: DeliveryAddress | null | undefined): string {
  if (!a) return ""
  return [a.addressLine1, a.area, a.landmark ? `Near ${a.landmark}` : null, a.city, a.pincode]
    .filter(Boolean)
    .join(", ")
}

/** Short pill label for the header — "Home", "Office", "Bandra West", … */
export function shortAddressLabel(a: DeliveryAddress | null | undefined): string {
  if (!a) return "Set Delivery Address"
  if (a.label) return a.label
  if (a.area) return a.area
  if (a.city) return a.city
  return "Selected Address"
}

// ── Google Place → DeliveryAddress ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildDeliveryAddressFromPlace(place: any): DeliveryAddress {
  const parts: Record<string, string> = {}
  const order: string[] = []

  for (const comp of place.address_components || []) {
    const type = (comp.types || [])[0]
    if (!type || !parts[type]) parts[type] = comp.long_name
  }

  const streetNumber = parts.street_number || ""
  const route = parts.route || ""
  const street = [streetNumber, route].filter(Boolean).join(" ")
  const area =
    parts.sublocality_level_2 ||
    parts.sublocality_level_1 ||
    parts.neighborhood ||
    parts.locality ||
    ""

  order.push(area)
  order.push(parts.locality || parts.administrative_area_level_2 || "")
  order.push(parts.administrative_area_level_1 || "")

  return {
    addressLine1: street || place.name || "",
    area: area || null,
    city: parts.locality || parts.administrative_area_level_2 || null,
    state: parts.administrative_area_level_1 || null,
    pincode: parts.postal_code || null,
    country: parts.country || "India",
    latitude: place.geometry?.location?.lat?.() ?? null,
    longitude: place.geometry?.location?.lng?.() ?? null,
    googlePlaceId: place.place_id || null,
    formattedAddress: place.formatted_address || null,
  }
}

/** Reverse geocode a lat/lng into a DeliveryAddress (Google Geocoder). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reverseGeocodeAddress(google: any, lat: number, lng: number): Promise<DeliveryAddress | null> {
  const geocoder = new google.maps.Geocoder()
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results: unknown[], status: string) => {
      if (status === "OK" && results && results.length > 0) {
        resolve(buildDeliveryAddressFromPlace(results[0]))
      } else {
        resolve(null)
      }
    })
  })
}

/** Convert a DeliveryAddress into the address-book API body (strip id). */
export function addressApiBody(a: DeliveryAddress) {
  return {
    label: a.label || undefined,
    area: a.area || undefined,
    line1: a.addressLine1 || undefined,
    landmark: a.landmark || undefined,
    city: a.city || undefined,
    state: a.state || undefined,
    pincode: a.pincode || undefined,
    latitude: a.latitude ?? undefined,
    longitude: a.longitude ?? undefined,
    googlePlaceId: a.googlePlaceId || undefined,
    formattedAddress: a.formattedAddress || undefined,
    instructions: a.instructions || undefined,
  }
}
