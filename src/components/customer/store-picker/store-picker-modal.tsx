"use client"

import React, { useEffect, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"
import { X, MapPin, CheckCircle2, Store, Bike, Clock } from "lucide-react"

interface StoreTiming { day: number; openTime: string; closeTime: string; isClosed: boolean }

interface StoreOption {
  id: string
  name: string
  address?: string | null
  city?: string | null
  pincode?: string | null
  deliveryFee?: number | null
  minOrderAmount?: number | null
  freeDeliveryAbove?: number | null
  preparationTime?: number | null
  isMainStore?: boolean
  distance?: number | null
  serviceable?: boolean
  storeTimings?: StoreTiming[]
}

// Returns { open: boolean, label: string } based on current local time and storeTimings
function getOpenStatus(timings?: StoreTiming[]): { open: boolean; label: string } {
  if (!timings || timings.length === 0) return { open: true, label: "Open" }
  const now = new Date()
  const day = now.getDay() // 0 = Sunday
  const todayTiming = timings.find((t) => t.day === day)
  if (!todayTiming || todayTiming.isClosed) return { open: false, label: "Closed today" }
  const [oh, om] = todayTiming.openTime.split(":").map(Number)
  const [ch, cm] = todayTiming.closeTime.split(":").map(Number)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const openMin = oh * 60 + om
  const closeMin = ch * 60 + cm
  if (nowMin >= openMin && nowMin < closeMin) {
    // Close within 30 min → "Closes at HH:MM"
    if (closeMin - nowMin <= 30) return { open: true, label: `Closes at ${todayTiming.closeTime}` }
    return { open: true, label: `Open until ${todayTiming.closeTime}` }
  }
  if (nowMin < openMin) return { open: false, label: `Opens at ${todayTiming.openTime}` }
  return { open: false, label: "Closed" }
}

interface StorePickerModalProps {
  open: boolean
  onClose: () => void
}

export function StorePickerModal({ open, onClose }: StorePickerModalProps) {
  const {
    currentBusinessId,
    currentStoreId,
    setCurrentStoreId,
    setCurrentStoreName,
    currentBusinessPrimaryColor,
  } = useAdminStore()
  const { setCartStoreId, setStoreContext } = useCartStore()
  const brandColor = currentBusinessPrimaryColor || "#10B981"

  const [stores, setStores] = useState<StoreOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !currentBusinessId) return

    setLoading(true)

    const fetchStores = (lat?: number, lng?: number) => {
      fetch("/api/core/storefront/nearest-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, lat, lng }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setStores(json.data as StoreOption[])
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchStores(pos.coords.latitude, pos.coords.longitude),
        () => fetchStores(),
        { timeout: 5000, maximumAge: 300_000 }
      )
    } else {
      fetchStores()
    }
  }, [open, currentBusinessId])

  const handleSelect = (store: StoreOption) => {
    setCurrentStoreId(store.id)
    setCurrentStoreName(store.name)
    setCartStoreId(store.id)
    setStoreContext(store.deliveryFee ?? null, store.minOrderAmount ?? null)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-t-2xl z-50 max-h-[75vh] flex flex-col shadow-xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Choose Your Store</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Store List */}
        <div className="overflow-y-auto flex-1 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
              <Store className="w-8 h-8" />
              <p className="text-sm">No stores available</p>
            </div>
          ) : (
            stores.map((store) => {
              const isSelected = store.id === currentStoreId
              const openStatus = getOpenStatus(store.storeTimings)
              return (
                <button
                  key={store.id}
                  onClick={() => handleSelect(store)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Store icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
                  >
                    <Store className="w-4 h-4" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{store.name}</span>
                      {store.isMainStore && (
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
                        >
                          Main
                        </span>
                      )}
                      {/* Open / closed badge */}
                      <span className={`flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        openStatus.open
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        {openStatus.label}
                      </span>
                    </div>

                    {(store.address || store.city) && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {[store.address, store.city].filter(Boolean).join(", ")}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {store.deliveryFee !== null && store.deliveryFee !== undefined && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                          <Bike className="w-3 h-3" />
                          {store.deliveryFee === 0
                            ? "Free delivery"
                            : store.freeDeliveryAbove
                              ? `₹${store.deliveryFee} · Free above ₹${store.freeDeliveryAbove}`
                              : `₹${store.deliveryFee} delivery`}
                        </span>
                      )}
                      {store.minOrderAmount !== null &&
                        store.minOrderAmount !== undefined &&
                        store.minOrderAmount > 0 && (
                          <span className="text-[10px] text-gray-400">
                            Min ₹{store.minOrderAmount}
                          </span>
                        )}
                      {store.preparationTime != null && store.preparationTime > 0 && (
                        <span className="text-[10px] text-gray-400">
                          ~{store.preparationTime} min prep
                        </span>
                      )}
                      {store.distance !== null && store.distance !== undefined && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {store.distance} km
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selected checkmark */}
                  {isSelected && (
                    <CheckCircle2
                      className="w-5 h-5 shrink-0 mt-1"
                      style={{ color: brandColor }}
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
