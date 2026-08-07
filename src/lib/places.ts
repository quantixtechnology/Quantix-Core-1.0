"use client"

// ============================================================================
// QUANTIX — Google address search helpers
//
// These helpers perform address search + place resolution with the Google
// **Geocoding API** (via `google.maps.Geocoder`). Geocoding is a Core Maps
// service that is enabled on every Maps Platform key used by QUANTIX, and is
// the same service already powering reverse-geocoding/My Location/marker flows.
//
// It is intentionally NOT built on the "Places API (New)"
// (`AutocompleteSuggestion.fetchAutocompleteSuggestions`) nor the legacy
// `google.maps.places.AutocompleteService`, because the Google Cloud project
// that owns the production key has that (separately-billed) Places service
// disabled — requests were rejected with SERVICE_DISABLED/REQUEST_DENIED.
//
// Every result carries the same shape the UI already consumes
// (placeId, formatted address, lat/lng, address parts, viewport), and
// `googlePlaceId` is preserved for persistence continuity.
// ============================================================================

export interface PlaceSuggestion {
  placeId: string
  primaryText: string
  secondaryText: string
}

export interface PlaceDetails {
  googlePlaceId: string | null
  formattedAddress: string | null
  displayName: string | null
  addressLine1: string | null
  area: string | null
  city: string | null
  state: string | null
  pincode: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  viewport: { north: number; south: number; east: number; west: number } | null
}

interface FetchSuggestionsOptions {
  country?: string
  language?: string
}

function componentsToParts(components: any[] | undefined): Record<string, string> {
  const parts: Record<string, string> = {}
  for (const comp of components || []) {
    const type = comp?.types?.[0]
    if (type && !parts[type]) parts[type] = comp.long_name || comp.short_name || ""
  }
  return parts
}

function coordOf(value: any): number | null {
  if (typeof value === "function") {
    try {
      const n = value()
      return typeof n === "number" ? n : null
    } catch {
      return null
    }
  }
  return typeof value === "number" ? value : null
}

function coordsOfResult(rec: any): { lat: number | null; lng: number | null } {
  const loc = rec?.geometry?.location
  return { lat: coordOf(loc?.lat), lng: coordOf(loc?.lng) }
}

function viewportOfResult(rec: any): PlaceDetails["viewport"] {
  const vp = rec?.geometry?.viewport
  if (!vp) return null
  let ne: any = null
  let sw: any = null
  try {
    ne = typeof vp.getNorthEast === "function" ? vp.getNorthEast() : vp.northeast || vp.north
    sw = typeof vp.getSouthWest === "function" ? vp.getSouthWest() : vp.southwest || vp.south
  } catch {
    return null
  }
  if (ne === null || sw === null) return null
  const north = coordOf(ne.lat ?? ne.latitude)
  const east = coordOf(ne.lng ?? ne.longitude)
  const south = coordOf(sw.lat ?? sw.latitude)
  const west = coordOf(sw.lng ?? sw.longitude)
  if ([north, east, south, west].some((v) => v === null)) return null
  return { north: north!, south: south!, east: east!, west: west! }
}

/** Build a suggestion row (primary/secondary text) from a Geocoder result. */
function buildSuggestion(rec: any): PlaceSuggestion {
  const parts = componentsToParts(rec.address_components)
  const street = [parts.street_number, parts.route].filter(Boolean).join(" ").trim()
  const locality =
    parts.sublocality_level_2 || parts.sublocality_level_1 || parts.neighborhood || parts.locality || ""
  const formatted: string = rec.formatted_address || ""

  let primaryText = street || locality || formatted.split(",")[0]?.trim() || "Selected location"
  let secondaryText = ""
  if (formatted) {
    const firstLine = formatted.split(",")[0]?.trim() || ""
    const rest = formatted.slice(firstLine.length).trim().replace(/^,/, "").trim()
    if (rest) secondaryText = rest
  }
  return {
    placeId: rec.place_id || formatted,
    primaryText,
    secondaryText,
  }
}

/** Convert a Geocoder result into the shared PlaceDetails shape. */
function buildPlaceDetails(rec: any): PlaceDetails {
  const parts = componentsToParts(rec.address_components)
  const street = [parts.street_number, parts.route].filter(Boolean).join(" ").trim()
  const { lat, lng } = coordsOfResult(rec)
  const formattedAddress: string | null = rec.formatted_address || null
  const area =
    parts.sublocality_level_2 || parts.sublocality_level_1 || parts.neighborhood || parts.locality || null
  const primary = street || area || formattedAddress || null

  return {
    googlePlaceId: rec.place_id || null,
    formattedAddress,
    displayName: primary,
    addressLine1: primary,
    area,
    city: parts.locality || parts.administrative_area_level_2 || null,
    state: parts.administrative_area_level_1 || null,
    pincode: parts.postal_code || null,
    country: parts.country || "India",
    latitude: lat,
    longitude: lng,
    viewport: viewportOfResult(rec),
  }
}

function geocode(
  google: any,
  params: { [k: string]: unknown },
): Promise<{ results: any[]; status: string }> {
  return new Promise((resolve, reject) => {
    try {
      new google.maps.Geocoder().geocode(params, (r: any, s: string) =>
        resolve({ results: r || [], status: s }),
      )
    } catch (e) {
      reject(e)
    }
  })
}

/** Address search suggestions via the Geocoding API (Geocoder). */
export async function fetchPlaceSuggestions(
  google: any,
  input: string,
  options: FetchSuggestionsOptions = {},
): Promise<PlaceSuggestion[]> {
  if (!google?.maps?.Geocoder) {
    throw new Error("Geocoder is not available")
  }
  const params: { [k: string]: unknown } = { address: input, region: "in" }
  if (options.country) params.componentRestrictions = { country: options.country || "IN" }

  const { results, status } = await geocode(google, params)
  if (status !== "OK" || results.length === 0) {
    throw new Error(`Geocoding failed with status: ${status}`)
  }
  return results.map(buildSuggestion)
}

/** Resolve a geocoded place by its googlePlaceId. */
export async function fetchPlaceDetails(
  google: any,
  placeId: string,
): Promise<PlaceDetails> {
  if (!google?.maps?.Geocoder) {
    throw new Error("Geocoder is not available")
  }
  const { results, status } = await geocode(google, { placeId })
  if (status !== "OK" || !results[0]) {
    throw new Error(`Geocode by place ID failed with status: ${status}`)
  }
  return buildPlaceDetails(results[0])
}