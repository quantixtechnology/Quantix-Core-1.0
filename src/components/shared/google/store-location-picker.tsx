"use client"

// ============================================================================
// QUANTIX — Reusable Store / Drop Location Picker (admin + management screens)
//
// Map-first Google location selection used for store create/edit across every
// workspace (Commerce Store, LaundryStore, and any future product). Provides
// one control with:
//     Google address search      (Places Autocomplete)
//     Interactive map            (draggable marker)
//     My Location                (device GPS + reverse geocode)
//     Reverse geocoding          (marker → structured address parts)
//
// The consumer always receives latitude + longitude + googlePlaceId +
// formattedAddress captured TOGETHER from the map. There are NO manual
// lat/lng text inputs — a location is guaranteed complete or absent.
// ============================================================================

import { useEffect, useRef, useState, useCallback } from "react"
import { requestCoords, geoMessageWithFallback } from "@/lib/geolocation"
import { Navigation, Loader2 } from "lucide-react"
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps"
import type { PlaceDetails } from "@/lib/places"
import { PlacesSearch } from "./places-search"

export interface StoreLocation {
  latitude: number | null
  longitude: number | null
  googlePlaceId: string | null
  formattedAddress: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

interface StoreLocationPickerProps {
  value: StoreLocation
  onChange: (loc: StoreLocation) => void
  placeholder?: string
}

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 }

function extractParts(
  components: any[] | undefined,
  formattedAddress?: string | null,
): { address: string | null; city: string | null; state: string | null; pincode: string | null } {
  const parts: Record<string, string> = {}
  for (const comp of components || []) {
    const type = (comp.types || [])[0]
    if (type && !parts[type]) parts[type] = comp.long_name
  }
  const streetNumber = parts.street_number || ""
  const route = parts.route || ""
  const street = [streetNumber, route].filter(Boolean).join(" ").trim()
  return {
    address: street || parts.sublocality_level_1 || parts.sublocality_level_2 || formattedAddress || null,
    city: parts.locality || parts.administrative_area_level_2 || null,
    state: parts.administrative_area_level_1 || null,
    pincode: parts.postal_code || null,
  }
}

export function StoreLocationPicker({
  value,
  onChange,
  placeholder = "Search store address",
}: StoreLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
   
  const markerInstance = useRef<any>(null)
   
  const googleRef = useRef<any>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [locating, setLocating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState("")

  const applyLocation = useCallback(
     
    (google: any, lat: number, lng: number, placeId: string | null, formattedAddress: string | null) => {
      mapInstance.current?.setCenter({ lat, lng })
      // The marker exists only once a location has actually been chosen — see
      // the map init below for why showing one by default was misleading.
      if (!markerInstance.current && mapInstance.current) {
        const m = new google.maps.Marker({ position: { lat, lng }, map: mapInstance.current, draggable: true })
        m.addListener("dragend", () => {
          const p = m.getPosition()
          if (p) applyLocationRef.current?.(google, p.lat(), p.lng(), null, null)
        })
        markerInstance.current = m
      }
      markerInstance.current?.setPosition({ lat, lng })
      if (mapInstance.current?.setZoom) mapInstance.current.setZoom(16)
      setResolving(true)
      setError("")
      const geocoder = new google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results: unknown[], status: string) => {
        setResolving(false)
        if (status === "OK" && results && results[0]) {
           
          const rec = results[0] as any
          const { address, city, state, pincode } = extractParts(
            rec.address_components,
            rec.formatted_address
          )
          onChange({
            latitude: lat,
            longitude: lng,
            googlePlaceId: placeId || rec.place_id || null,
            formattedAddress: formattedAddress || rec.formatted_address || null,
            address,
            city,
            state,
            pincode,
          })
        } else {
          // Reverse geocode failed — keep coordinates but clear address parts so
          // the record is never saved with stale/mismatched text.
          onChange({
            latitude: lat,
            longitude: lng,
            googlePlaceId: placeId || null,
            formattedAddress: formattedAddress || null,
            address: null,
            city: null,
            state: null,
            pincode: null,
          })
          setError("Could not resolve this location's address. Move the pin or search again.")
        }
      })
    },
    [onChange]
  )

  // Map listeners are registered once, so they call through a ref rather than
  // capturing the first applyLocation and going stale.
  const applyLocationRef = useRef<typeof applyLocation | null>(null)
  useEffect(() => { applyLocationRef.current = applyLocation }, [applyLocation])

  // Initialize the map once the loader is ready.
  useEffect(() => {
    if (!hasGoogleMapsKey()) return
    let mounted = true

    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapRef.current) return
        googleRef.current = google

        const hasLocation =
          typeof value.latitude === "number" && typeof value.longitude === "number"
        const start = hasLocation
          ? { lat: value.latitude as number, lng: value.longitude as number }
          : DEFAULT_CENTER
         
        const map = new google.maps.Map(mapRef.current as HTMLElement, {
          center: start,
          zoom: hasLocation ? 16 : 11,
          gestureHandling: "cooperative",
          fullscreenControl: false,
          streetViewControl: false,
        })
        mapInstance.current = map

        // A marker is drawn ONLY when a location has been chosen. Showing one at
        // the default centre made an unset store look pinned — the map said
        // "here" while the panel said LOCATION NOT SAVED.
        if (hasLocation) {
           
          const marker = new google.maps.Marker({ position: start, map, draggable: true })
          markerInstance.current = marker
          marker.addListener("dragend", () => {
            const pos = marker.getPosition()
            if (pos) applyLocationRef.current?.(google, pos.lat(), pos.lng(), value.googlePlaceId ?? null, null)
          })
        }

        // Clicking the map places the pin. This is the obvious way to "drop a
        // pin", and it was missing: the only way to move the marker was to
        // discover it could be dragged, which the screen never said.
         
        map.addListener("click", (e: any) => {
          const lat = e?.latLng?.lat?.()
          const lng = e?.latLng?.lng?.()
          if (typeof lat === "number" && typeof lng === "number") {
            applyLocationRef.current?.(google, lat, lng, null, null)
          }
        })

        setMapsReady(true)
      })
      .catch(() => setError("Could not load the map. Please try again."))

    return () => {
      mounted = false
      mapInstance.current = null
      markerInstance.current = null
    }
     
  }, [])

// Search: resolve a picked place with the Places API (New) and sync map + value.
  const onPlaceSelected = (details: PlaceDetails) => {
    if (
      typeof details.latitude !== "number" ||
      typeof details.longitude !== "number"
    ) {
      setError("Could not resolve that place — choose from the suggestions.")
      return
    }
    setError("")
    const google = googleRef.current
    if (google) {
      applyLocation(
        google,
        details.latitude,
        details.longitude,
        details.googlePlaceId,
        details.formattedAddress
      )
    } else {
      onChange({
        latitude: details.latitude,
        longitude: details.longitude,
        googlePlaceId: details.googlePlaceId ?? null,
        formattedAddress: details.formattedAddress ?? null,
        address: details.addressLine1 || details.area || null,
        city: details.city,
        state: details.state,
        pincode: details.pincode,
      })
    }
  }

  const useMyLocation = async () => {
    // Every attempt starts clean — a previous failure must never be the state a
    // later click is judged by.
    setError("")
    setLocating(true)
    // Coordinates FIRST, with no Google Maps involved. POSITION_UNAVAILABLE
    // (macOS kCLErrorLocationUnknown) is retried briefly before giving up.
    const res = await requestCoords()
    setLocating(false)

    if (!res.ok) {
      setError(geoMessageWithFallback(res, "store"))
      return
    }
    const { latitude, longitude } = res
    if (googleRef.current) {
      // Only now: centre, mark, reverse geocode, fill address/city/state/pincode.
      applyLocation(googleRef.current, latitude, longitude, null, null)
    } else {
      // No Maps yet (or no API key): keep the fix rather than discard it.
      onChange({
        latitude, longitude,
        googlePlaceId: null, formattedAddress: null,
        address: null, city: null, state: null, pincode: null,
      })
    }
  }

  const noKey = !hasGoogleMapsKey()

  return (
    <div className="space-y-3">
      {/* Search */}
      <PlacesSearch
        onSelect={onPlaceSelected}
        placeholder={placeholder}
        icon="pin"
        inputClassName="w-full pl-10 pr-3 h-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white disabled:opacity-50"
        disabled={noKey}
      />

      {/* My location */}
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating || (!noKey && !mapsReady)}
        className="w-full flex items-center justify-center gap-2 py-2 border border-dashed rounded-xl text-xs font-medium disabled:opacity-60"
      >
        {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
        {locating ? "Getting your location…" : "Use My Location"}
      </button>

      {/* Map */}
      <div className="relative h-52 rounded-xl overflow-hidden border border-gray-200">
        {noKey ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-xs text-gray-400">
            Google Maps is not configured for this environment.
          </div>
        ) : (
          <>
            {!mapsReady && (
              <div className="absolute inset-0 z-[2] flex items-center justify-center bg-gray-50">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            )}
            <div ref={mapRef} className="absolute inset-0" />
          </>
        )}
      </div>

      {/* Resolved location summary */}
      {value.latitude != null && value.longitude != null && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          {resolving ? (
            <p className="text-gray-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Resolving address…
            </p>
          ) : value.formattedAddress || value.address ? (
            <div>
              <p className="font-semibold text-gray-900">{value.address || value.formattedAddress}</p>
              {value.formattedAddress && value.formattedAddress !== value.address && (
                <p className="text-gray-500 mt-0.5">{value.formattedAddress}</p>
              )}
              <p className="mt-1 font-mono text-gray-400">
                ({value.latitude.toFixed(6)}, {value.longitude.toFixed(6)})
              </p>
            </div>
          ) : (
            <p className="text-gray-500">
              Selected point ({value.latitude!.toFixed(6)}, {value.longitude!.toFixed(6)})
            </p>
          )}
        </div>
      )}

      {/* The map is the fallback when the device cannot locate itself, so say
          that it is interactive — previously nothing on screen did. */}
      {!noKey && mapsReady && (
        <p className="text-[11px] text-gray-500">Click the map to drop the pin, or drag it to fine-tune.</p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}