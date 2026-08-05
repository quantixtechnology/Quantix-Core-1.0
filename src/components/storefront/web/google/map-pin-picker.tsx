"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { X, Loader2, MapPin, Navigation, Check } from "lucide-react"
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps"
import { reverseGeocodeAddress, formatAddressLine } from "@/lib/delivery-address"
import type { DeliveryAddress } from "@/stores/cart-store"

interface MapPinPickerProps {
  open: boolean
  initial?: DeliveryAddress | null
  brandColor: string
  onConfirm: (address: DeliveryAddress) => void
  onClose: () => void
}

const DEFAULT_CENTER = { lat: 19.076, lng: 72.8777 }

/**
 * Full-screen map with a draggable pin. Dropping the pin reverse-geocodes the
 * exact coordinate into a structured DeliveryAddress. This is how every address
 * gets its authoritative lat/lng (never device GPS as the source of truth).
 */
export function MapPinPicker({ open, initial, brandColor, onConfirm, onClose }: MapPinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<{ setCenter: (c: { lat: number; lng: number }) => void } | null>(null)
  const markerInstance = useRef<{ setPosition: (c: { lat: number; lng: number }) => void } | null>(null)
  const reverseGeocoderRef = useRef<unknown | null>(null)

  const [mapsReady, setMapsReady] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [locating, setLocating] = useState(false)
  const [address, setAddress] = useState<DeliveryAddress | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movePin = useCallback((google: any, lat: number, lng: number) => {
    mapInstance.current?.setCenter({ lat, lng })
    markerInstance.current?.setPosition({ lat, lng })
    setGeocoding(true)
    reverseGeocodeAddress(google, lat, lng)
      .then((addr) => {
        if (addr) setAddress({ ...addr, latitude: lat, longitude: lng })
      })
      .catch(() => setError("Could not resolve this location."))
      .finally(() => setGeocoding(false))
  }, [])

  useEffect(() => {
    if (!open) return
    if (!hasGoogleMapsKey()) {
      setError("Map service is not configured. Please enter your address manually or use current location.")
      return
    }
    let mounted = true

    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !mapRef.current) return
        const startLat = initial?.latitude ?? DEFAULT_CENTER.lat
        const startLng = initial?.longitude ?? DEFAULT_CENTER.lng
        const center = { lat: startLat, lng: startLng }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new google.maps.Map(mapRef.current as HTMLElement, {
          center,
          zoom: 15,
          disableDefaultUI: false,
          gestureHandling: "cooperative",
        })
        mapInstance.current = map

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const marker = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          animation: google.maps.Animation.DROP,
        })
        markerInstance.current = marker
        reverseGeocoderRef.current = google

        if (initial?.latitude && initial?.longitude) {
          setAddress(initial)
        } else {
          movePin(google, startLat, startLng)
        }

        marker.addListener("dragend", () => {
          const pos = marker.getPosition()
          if (!pos) return
          movePin(google, pos.lat(), pos.lng())
        })

        setMapsReady(true)
      })
      .catch(() => {
        if (mounted) setError("Could not load the map. Please try again.")
      })

    return () => {
      mounted = false
      mapInstance.current = null
      markerInstance.current = null
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = () => {
    if (!navigator.geolocation || !reverseGeocoderRef.current) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        movePin(reverseGeocoderRef.current, pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      () => {
        setError("Location access denied.")
        setLocating(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const confirmPin = () => {
    if (!address?.latitude || !address?.longitude) {
      setError("Drop the pin on your exact delivery location first.")
      return
    }
    setConfirming(true)
    onConfirm(address)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-bold text-gray-900 text-[15px]">Drop pin on exact location</h2>
        <button
          onClick={useMyLocation}
          disabled={locating || !reverseGeocoderRef.current}
          className="ml-auto flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-full border"
          style={{ borderColor: `${brandColor}55`, color: brandColor }}
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
          My location
        </button>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        {!mapsReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              <p className="text-xs text-gray-400">Loading map…</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="absolute inset-0" />
        {error && !mapsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="max-w-xs text-center px-4">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        )}

        {/* Confirmation card */}
        {mapsReady && (
          <div className="absolute bottom-4 inset-x-4 sm:max-w-md sm:mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 shrink-0" style={{ color: brandColor }} />
              {geocoding ? (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Resolving location…
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Deliver to this address</span>
              )}
            </div>
            <p className="text-sm text-gray-900 min-h-[20px]">
              {address ? formatAddressLine(address) : "Drag the pin to your exact location"}
            </p>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <button
              onClick={confirmPin}
              disabled={confirming || geocoding}
              className="mt-3 w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Address
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
