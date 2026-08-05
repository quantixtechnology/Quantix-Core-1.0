"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps"
import { buildDeliveryAddressFromPlace } from "@/lib/delivery-address"
import type { DeliveryAddress } from "@/stores/cart-store"

interface PlacesAutocompleteProps {
  onSelect: (address: DeliveryAddress) => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Google Places address autocomplete input. When the customer picks a
 * suggestion the fully-structured DeliveryAddress (including lat/lng + Place ID)
 * is returned. Degrades to a plain text input when no Maps key is configured.
 */
export function PlacesAutocomplete({
  onSelect,
  placeholder = "Search your delivery address",
  autoFocus = false,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [error, setError] = useState("")
  const autocompleteRef = useRef<{ unbindAll?: () => void } | null>(null)

  useEffect(() => {
    if (!hasGoogleMapsKey()) return
    let mounted = true
    let ac: { addListener?: (t: string, cb: () => void) => void; unbindAll?: () => void } | null = null

    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !inputRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ac = new google.maps.places.Autocomplete(inputRef.current as HTMLInputElement, {
          types: ["address"],
          componentRestrictions: { country: "IN" },
        })
        autocompleteRef.current = ac
        const acInstance = ac!
        acInstance.addListener?.("place_changed", () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const place = (acInstance as any).getPlace()
          if (!place || !place.geometry) {
            setError("Could not resolve that address — try choosing from the suggestions.")
            return
          }
          setError("")
          onSelect(buildDeliveryAddressFromPlace(place))
        })
        setMapsReady(true)
      })
      .catch(() => {
        // No key — component behaves as a plain text field; manual entry handled upstream.
      })

    return () => {
      mounted = false
      autocompleteRef.current?.unbindAll?.()
      autocompleteRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative">
      {hasGoogleMapsKey() ? (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      ) : null}
      <input
        ref={inputRef}
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={hasGoogleMapsKey() && !mapsReady}
        className="w-full pl-10 pr-3 h-11 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white disabled:opacity-50"
      />
      {hasGoogleMapsKey() && !mapsReady && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
