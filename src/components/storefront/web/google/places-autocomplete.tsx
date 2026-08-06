"use client"

import { hasGoogleMapsKey } from "@/lib/google-maps"
import { buildDeliveryAddressFromPlaceDetails } from "@/lib/delivery-address"
import type { DeliveryAddress } from "@/stores/cart-store"
import { PlacesSearch } from "@/components/shared/google/places-search"

interface PlacesAutocompleteProps {
  onSelect: (address: DeliveryAddress) => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Google Places address autocomplete input (Places API (New)). When the
 * customer picks a suggestion the fully-structured DeliveryAddress (including
 * lat/lng + Place ID) is returned. Degrades to a plain text input when no Maps
 * key is configured.
 */
export function PlacesAutocomplete({
  onSelect,
  placeholder = "Search your delivery address",
  autoFocus = false,
}: PlacesAutocompleteProps) {
  if (!hasGoogleMapsKey()) {
    return (
      <input
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full px-3 h-11 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white"
      />
    )
  }

  return (
    <PlacesSearch
      onSelect={(details) => onSelect(buildDeliveryAddressFromPlaceDetails(details))}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  )
}
