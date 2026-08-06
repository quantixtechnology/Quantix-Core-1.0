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
import { Search, Navigation, Loader2, MapPin } from "lucide-react"
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps"

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
  const inputRef = useRef<HTMLInputElement>(null)
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

  // Initialize the map once the loader is ready.
  useEffect(() => {
    if (!hasGoogleMapsKey()) return
    let mounted = true

    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapRef.current) return
        googleRef.current = google

        const start =
          typeof value.latitude === "number" && typeof value.longitude === "number"
            ? { lat: value.latitude, lng: value.longitude }
            : DEFAULT_CENTER
         
        const map = new google.maps.Map(mapRef.current as HTMLElement, {
          center: start,
          zoom: 16,
          gestureHandling: "cooperative",
          fullscreenControl: false,
          streetViewControl: false,
        })
        mapInstance.current = map

         
        const marker = new google.maps.Marker({
          position: start,
          map,
          draggable: true,
        })
        markerInstance.current = marker

        marker.addListener("dragend", () => {
          const pos = marker.getPosition()
          if (!pos) return
          applyLocation(google, pos.lat(), pos.lng(), value.googlePlaceId ?? null, null)
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

  // Set up Places Autocomplete bound to the same google namespace.
  useEffect(() => {
    if (!hasGoogleMapsKey()) return
    let mounted = true
    let ac: { addListener?: (t: string, cb: () => void) => void; unbindAll?: () => void } | null = null

    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !inputRef.current || !google?.maps?.places) return
         
        ac = new google.maps.places.Autocomplete(inputRef.current as HTMLInputElement, {
          types: ["establishment", "address"],
          componentRestrictions: { country: "IN" },
        })
        const inst = ac!
        inst.addListener?.("place_changed", () => {
           
          const place = (inst as any).getPlace()
          if (!place?.geometry?.location) {
            setError("Could not resolve that place — choose from the suggestions.")
            return
          }
          setError("")
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()
          const { address = null, city = null, state = null, pincode = null } = extractParts(
            place.address_components,
            place.formatted_address
          )
          applyLocation(google, lat, lng, place.place_id || null, place.formatted_address || null)
          onChange({
            latitude: lat,
            longitude: lng,
            googlePlaceId: place.place_id || null,
            formattedAddress: place.formatted_address || null,
            address,
            city,
            state,
            pincode,
          })
        })
      })
      .catch(() => {})
    return () => {
      mounted = false
      ac?.unbindAll?.()
    }
     
  }, [])

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available on this device.")
      return
    }
    setLocating(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        if (googleRef.current) {
          applyLocation(googleRef.current, pos.coords.latitude, pos.coords.longitude, null, null)
        }
      },
      () => {
        setLocating(false)
        setError("Location access denied. Search for the store or drop a pin instead.")
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const noKey = !hasGoogleMapsKey()

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={!noKey && !mapsReady}
          className="w-full pl-10 pr-3 h-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white disabled:opacity-50"
        />
        {!noKey && !mapsReady && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
          </div>
        )}
      </div>

      {/* My location */}
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating || (!noKey && !mapsReady)}
        className="w-full flex items-center justify-center gap-2 py-2 border border-dashed rounded-xl text-xs font-medium disabled:opacity-60"
      >
        {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
        Use My Location
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

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}