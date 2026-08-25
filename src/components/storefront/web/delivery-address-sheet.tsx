"use client"

import { useEffect, useState, useCallback } from "react"
import { requestCoords, geoMessageWithFallback } from "@/lib/geolocation"
import {
  X, MapPin, Navigation, Search, Loader2, Check, Home, Plus,
} from "lucide-react"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store"
import { useAdminStore } from "@/stores/admin-store"
import type { DeliveryAddress } from "@/stores/cart-store"
import { formatAddressLine } from "@/lib/delivery-address"
import { PlacesAutocomplete } from "./google/places-autocomplete"
import { GoogleAddressPicker } from "./google/address-picker"

interface SavedAddressRow {
  id: string
  label?: string | null
  area?: string | null
  addressLine1: string
  addressLine2?: string | null
  landmark?: string | null
  city: string
  state: string
  pincode: string
  latitude?: number | null
  longitude?: number | null
  googlePlaceId?: string | null
  formattedAddress?: string | null
  instructions?: string | null
  isDefault: boolean
}

interface DeliveryAddressSheetProps {
  open: boolean
  brandColor: string
  onSelect: (address: DeliveryAddress) => void
  onClose: () => void
}

const emptyAddr = (): DeliveryAddress => ({
  label: "Home",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
})

/**
 * "Delivering To" bottom sheet — choose a delivery address from Saved Addresses,
 * Current Location, Google search or a pin on the map. Selecting an address NEVER
 * clears the cart; store assignment happens later at checkout.
 */
export function DeliveryAddressSheet({ open, brandColor, onSelect, onClose }: DeliveryAddressSheetProps) {
  const { isAuthenticated, token } = useAuthStore()
  const { currentBusinessId } = useAdminStore()

  const [saved, setSaved] = useState<SavedAddressRow[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [pending, setPending] = useState<DeliveryAddress | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const fetchSaved = useCallback(async () => {
    if (!isAuthenticated || !token) { setSaved([]); return }
    setLoadingSaved(true)
    try {
      const res = await fetch("/api/core/storefront/addresses", {
        headers: { Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
      })
      const data = await res.json()
      if (data.success) setSaved(data.data || [])
    } catch { /* non-critical */ } finally { setLoadingSaved(false) }
  }, [isAuthenticated, token, currentBusinessId])

  useEffect(() => {
    if (open) {
      setPending(null)
      setSavePending(false)
      setError("")
      setShowMap(false)
      fetchSaved()
    }
  }, [open, fetchSaved])

  const useCurrentLocation = async () => {
    setError("")
    setGpsBusy(true)
    const res = await requestCoords()
    setGpsBusy(false)

    if (!res.ok) {
      setError(geoMessageWithFallback(res, "address"))
      return
    }
    setPending({
      ...emptyAddr(),
      label: "My Location",
      area: "My Location",
      latitude: res.latitude,
      longitude: res.longitude,
    })
  }

  const chooseSaved = (row: SavedAddressRow) => {
    onSelect({
      id: row.id,
      label: row.label,
      area: row.area,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      landmark: row.landmark,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      latitude: row.latitude,
      longitude: row.longitude,
      googlePlaceId: row.googlePlaceId,
      formattedAddress: row.formattedAddress,
      instructions: row.instructions,
    })
    onClose()
  }

  const confirmPending = async () => {
    if (!pending) return
    setSaving(true); setError("")
    let final = pending
    if (isAuthenticated && token && savePending && !pending.id) {
      try {
        const res = await fetch("/api/core/storefront/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-business-id": currentBusinessId || "" },
          body: JSON.stringify({
            label: pending.label || "Home",
            area: pending.area || undefined,
            line1: pending.addressLine1,
            landmark: pending.landmark || undefined,
            city: pending.city,
            state: pending.state || undefined,
            pincode: pending.pincode,
            latitude: pending.latitude ?? undefined,
            longitude: pending.longitude ?? undefined,
            googlePlaceId: pending.googlePlaceId || undefined,
            formattedAddress: pending.formattedAddress || undefined,
          }),
        })
        const data = await res.json()
        if (data.success) final = { ...pending, id: data.data.id }
      } catch { /* non-critical — still proceed without saving */ }
    }
    setSaving(false)
    onSelect(final)
    onClose()
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Deliver to</h2>
              <p className="text-sm text-gray-500 mt-0.5">Your cart stays as-is — the store is chosen later</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 shrink-0 ml-3">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
            {/* Use Current Location */}
            <button
              onClick={useCurrentLocation}
              disabled={gpsBusy}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-colors disabled:opacity-60"
              style={{ borderColor: brandColor, backgroundColor: `${brandColor}08` }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: brandColor }}>
                {gpsBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Use Current Location</p>
                <p className="text-xs text-gray-500">Detect my GPS position</p>
              </div>
            </button>

            {/* Search */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Search className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Search address</p>
              </div>
              <PlacesAutocomplete onSelect={(a) => setPending(a)} autoFocus />
            </div>

            {/* Pending confirmation card */}
            {pending && (
              <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: brandColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{pending.label || "New address"}</p>
                    <p className="text-xs text-gray-500">{formatAddressLine(pending)}</p>
                    {pending.latitude && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        ({pending.latitude.toFixed(4)}, {pending.longitude?.toFixed(4)})
                      </p>
                    )}
                  </div>
                </div>
                {isAuthenticated && !pending.id && (
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={savePending}
                      onChange={(e) => setSavePending(e.target.checked)}
                      className="w-4 h-4 accent-current"
                      style={{ color: brandColor }}
                    />
                    Save to my addresses
                  </label>
                )}
                <button
                  onClick={confirmPending}
                  disabled={saving}
                  className="w-full h-10 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Deliver Here
                </button>
              </div>
            )}

            {/* Choose on map */}
            <button
              onClick={() => setShowMap(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-gray-200 text-left transition-colors hover:border-gray-300"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Choose on map</p>
                <p className="text-xs text-gray-500">Drop a pin for exact delivery</p>
              </div>
            </button>

            {/* Saved addresses */}
            {isAuthenticated && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">Saved Addresses</p>
                  <span className="text-xs text-gray-400">{saved.length}</span>
                </div>
                {loadingSaved ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : saved.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-2xl">
                    No saved addresses yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {saved.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => chooseSaved(row)}
                        className="w-full flex items-start gap-3 p-3 rounded-2xl border border-gray-100 hover:border-gray-300 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                          {row.label === "Home" ? <Home className="w-4 h-4 text-gray-500" /> : <MapPin className="w-4 h-4 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900">
                            {row.label || "Address"}
                            {row.isDefault && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: brandColor }}>Default</span>}
                          </p>
                          <p className="text-xs text-gray-500 line-clamp-2">{formatAddressLine(row)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs text-red-500 pt-1">{error}</p>}
          </div>
        </div>
      </div>

      {/* Full-screen map-first picker */}
      <GoogleAddressPicker
        open={showMap}
        initial={pending}
        brandColor={brandColor}
        businessId={currentBusinessId}
        saveLabel="Use This Location"
        onSave={(addr) => {
          setPending(addr)
          setShowMap(false)
          return Promise.resolve(true)
        }}
        onClose={() => setShowMap(false)}
      />
    </>
  )
}
