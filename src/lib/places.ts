"use client"

// ============================================================================
// QUANTIX — Google Places API (New) helpers
//
// Replaces every use of the legacy `google.maps.places.Autocomplete` widget
// with the supported New Places API surface:
//     AutocompleteSuggestion.fetchAutocompleteSuggestions()  → predictions
//     new google.maps.places.Place({ id }).fetchFields(...)  → place details
//
// No dependency on the legacy Places widget. All functions take the `google`
// namespace handed back by loadGoogleMaps() so callers stay testable.
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

/** Places API (New) autocomplete — returns place predictions for an input. */
export async function fetchPlaceSuggestions(
  google: any,
  input: string,
  options: FetchSuggestionsOptions = {},
): Promise<PlaceSuggestion[]> {
  const { AutocompleteSuggestion, AutocompleteSessionToken }: any = await google.maps.importLibrary("places")
  const params: Record<string, unknown> = {
    input,
    sessionToken: new AutocompleteSessionToken(),
    language: options.language ?? "en",
  }
  if (options.country) params.includedRegionCodes = [options.country]

  const { suggestions }: { suggestions: any[] } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(params)

  return (suggestions || [])
    .filter((s) => s?.placePrediction?.placeId)
    .map((s) => {
      const pred = s.placePrediction
      return {
        placeId: pred.placeId,
        primaryText: pred.text?.text ?? pred.structuredFormat?.mainText?.text ?? "",
        secondaryText:
          pred.text?.secondaryText ?? pred.structuredFormat?.secondaryText?.text ?? "",
      }
    })
}

/** Places API (New) place details — resolves a place ID into structured address + coordinates. */
export async function fetchPlaceDetails(
  google: any,
  placeId: string,
): Promise<PlaceDetails> {
  const { Place }: any = await google.maps.importLibrary("places")
  const place: any = await new Place({ id: placeId } as any).fetchFields({
    fields: ["id", "displayName", "formattedAddress", "addressComponents", "location", "viewport"],
  })

  const parts: Record<string, string> = {}
  for (const comp of place.addressComponents || []) {
    const type = comp.types?.[0]
    if (type && !parts[type]) parts[type] = comp.name || comp.shortText || ""
  }
  const streetNumber = parts.street_number || ""
  const route = parts.route || ""
  const street = [streetNumber, route].filter(Boolean).join(" ").trim()

  const location = place.location ?? {}
  const viewport = place.viewport ?? null

  return {
    googlePlaceId: place.id ?? placeId,
    formattedAddress: place.formattedAddress ?? null,
    displayName: place.displayName?.text ?? null,
    addressLine1: street || place.displayName?.text || null,
    area:
      parts.sublocality_level_2 ||
      parts.sublocality_level_1 ||
      parts.neighborhood ||
      parts.locality ||
      null,
    city: parts.locality || parts.administrative_area_level_2 || null,
    state: parts.administrative_area_level_1 || null,
    pincode: parts.postal_code || null,
    country: parts.country || "India",
    latitude: typeof location.lat === "number" ? location.lat : null,
    longitude: typeof location.lng === "number" ? location.lng : null,
    viewport: viewport
      ? {
          north: viewport.north,
          south: viewport.south,
          east: viewport.east,
          west: viewport.west,
        }
      : null,
  }
}
