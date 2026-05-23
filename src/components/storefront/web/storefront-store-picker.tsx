"use client"

import { useState, useEffect, useCallback } from "react"
import { MapPin, Navigation, ChevronRight, Store, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { formatINR } from "@/lib/currency"

export interface PickedStore {
  id: string
  name: string
  city: string | null
  deliveryFee: number | null
  freeDeliveryAbove: number | null
  minOrderAmount: number | null
  preparationTime: number | null
  latitude: number | null
  longitude: number | null
  deliveryRadius: number | null
}

interface StoreOption extends PickedStore {
  address: string | null
  state: string | null
  isMainStore: boolean
  distance?: number | null
  serviceable?: boolean
}

interface StorefrontStorePickerProps {
  businessId: string
  currentStoreId?: string
  brandColor: string
  mandatory?: boolean             // true = first visit, no close button
  onSelect: (store: PickedStore) => void
  onClose?: () => void
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function StorefrontStorePicker({
  businessId,
  currentStoreId,
  brandColor,
  mandatory = false,
  onSelect,
  onClose,
}: StorefrontStorePickerProps) {
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loading, setLoading] = useState(true)
  const [gpsState, setGpsState] = useState<"idle" | "requesting" | "granted" | "denied">("idle")
  const [customerLat, setCustomerLat] = useState<number | null>(null)
  const [customerLng, setCustomerLng] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(currentStoreId || null)
  const [confirming, setConfirming] = useState(false)

  // Annotate stores with distance from customer GPS
  const annotateDistances = useCallback(
    (raw: StoreOption[], lat: number, lng: number): StoreOption[] =>
      raw
        .map((s) => {
          const dist =
            s.latitude && s.longitude
              ? Math.round(haversineKm(lat, lng, s.latitude, s.longitude) * 10) / 10
              : null
          const serviceable =
            dist !== null ? dist <= (s.deliveryRadius ?? 20) : undefined
          return { ...s, distance: dist, serviceable }
        })
        .sort((a, b) => {
          if (a.distance === null) return 1
          if (b.distance === null) return -1
          return a.distance - b.distance
        }),
    []
  )

  // Fetch all stores for this business
  const fetchStores = useCallback(
    async (lat?: number, lng?: number) => {
      setLoading(true)
      try {
        const body: Record<string, unknown> = { businessId }
        if (lat !== undefined && lng !== undefined) { body.lat = lat; body.lng = lng }
        const res = await fetch("/api/core/storefront/nearest-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          let list: StoreOption[] = json.data
          if (lat !== undefined && lng !== undefined) {
            list = annotateDistances(list, lat, lng)
          }
          setStores(list)
          // Auto-select if only one store and no prior selection
          if (list.length === 1 && !currentStoreId) {
            setSelectedId(list[0].id)
          }
        }
      } catch {
        // non-critical — picker stays open
      } finally {
        setLoading(false)
      }
    },
    [businessId, currentStoreId, annotateDistances]
  )

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  // Request GPS silently on mount
  useEffect(() => {
    if (!navigator.geolocation) return
    setGpsState("requesting")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCustomerLat(lat)
        setCustomerLng(lng)
        setGpsState("granted")
        fetchStores(lat, lng)
      },
      () => {
        setGpsState("denied")
      },
      { timeout: 8000 }
    )
  }, []) // only on mount

  const requestGps = () => {
    if (!navigator.geolocation) return
    setGpsState("requesting")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCustomerLat(lat)
        setCustomerLng(lng)
        setGpsState("granted")
        fetchStores(lat, lng)
      },
      () => setGpsState("denied"),
      { timeout: 10000 }
    )
  }

  const handleConfirm = async () => {
    const store = stores.find((s) => s.id === selectedId)
    if (!store) return
    setConfirming(true)
    onSelect({
      id: store.id,
      name: store.name,
      city: store.city,
      deliveryFee: store.deliveryFee,
      freeDeliveryAbove: store.freeDeliveryAbove,
      minOrderAmount: store.minOrderAmount,
      preparationTime: store.preparationTime,
      latitude: store.latitude,
      longitude: store.longitude,
      deliveryRadius: store.deliveryRadius,
    })
  }

  // Nearest serviceable store (for "Recommended" badge)
  const nearestServiceable = gpsState === "granted"
    ? stores.find((s) => s.serviceable !== false && s.distance !== null)
    : null

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!mandatory ? onClose : undefined}
      />

      {/* Panel — bottom sheet on mobile, centered modal on sm+ */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Choose your store</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {gpsState === "granted"
                ? "Sorted by distance from your location"
                : "Select which store will deliver to you"}
            </p>
          </div>
          {!mandatory && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0 ml-3"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* GPS banner */}
        {gpsState === "idle" || gpsState === "denied" ? (
          <div className="mx-5 mb-3 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 shrink-0">
            <Navigation className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 flex-1">
              {gpsState === "denied"
                ? "Location access denied — showing all stores"
                : "Share your location to see nearest stores"}
            </p>
            {gpsState === "idle" && (
              <button
                onClick={requestGps}
                className="text-xs font-semibold text-blue-600 whitespace-nowrap hover:text-blue-800"
              >
                Allow
              </button>
            )}
          </div>
        ) : gpsState === "requesting" ? (
          <div className="mx-5 mb-3 flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Detecting your location…
          </div>
        ) : null}

        {/* Store list */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Loading stores…</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm text-gray-500">No stores available right now</p>
            </div>
          ) : (
            stores.map((store) => {
              const isSelected = selectedId === store.id
              const isNearest = nearestServiceable?.id === store.id
              const isOutOfRange = gpsState === "granted" && store.serviceable === false

              return (
                <button
                  key={store.id}
                  onClick={() => setSelectedId(store.id)}
                  className={[
                    "w-full text-left rounded-2xl border-2 p-4 transition-all",
                    isSelected
                      ? "border-current shadow-sm"
                      : "border-gray-100 hover:border-gray-200",
                    isOutOfRange ? "opacity-60" : "",
                  ].join(" ")}
                  style={isSelected ? { borderColor: brandColor } : {}}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Name row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{store.name}</span>
                        {store.isMainStore && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">
                            Main
                          </span>
                        )}
                        {isNearest && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-white"
                            style={{ backgroundColor: brandColor }}
                          >
                            Nearest
                          </span>
                        )}
                        {isOutOfRange && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-50 text-red-500">
                            Out of range
                          </span>
                        )}
                      </div>

                      {/* Address */}
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-500 truncate">
                          {[store.address, store.city, store.state].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>

                      {/* Distance */}
                      {store.distance !== undefined && store.distance !== null && (
                        <p className="text-xs font-medium mt-1" style={{ color: brandColor }}>
                          {store.distance < 1
                            ? `${Math.round(store.distance * 1000)} m away`
                            : `${store.distance} km away`}
                        </p>
                      )}

                      {/* Delivery info */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {store.deliveryFee !== null && (
                          <span className="text-[11px] text-gray-500">
                            Delivery: {store.deliveryFee === 0 ? "Free" : formatINR(store.deliveryFee)}
                          </span>
                        )}
                        {store.minOrderAmount !== null && store.minOrderAmount > 0 && (
                          <span className="text-[11px] text-gray-500">
                            Min: {formatINR(store.minOrderAmount)}
                          </span>
                        )}
                        {store.preparationTime !== null && (
                          <span className="text-[11px] text-gray-500">
                            {store.preparationTime}–{store.preparationTime + 10} min
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    <div className="shrink-0 mt-0.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: brandColor }} />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleConfirm}
            disabled={!selectedId || confirming || loading}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: brandColor }}
          >
            {confirming ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up store…</>
            ) : (
              <><Store className="w-4 h-4" /> Deliver from {stores.find(s => s.id === selectedId)?.name || "selected store"} <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
          {!mandatory && (
            <p className="text-[11px] text-gray-400 text-center mt-2">Changing store will clear your current cart</p>
          )}
        </div>
      </div>
    </div>
  )
}
