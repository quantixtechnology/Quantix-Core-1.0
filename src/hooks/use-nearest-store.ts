"use client"

import { useEffect, useRef } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { useCartStore } from "@/stores/cart-store"

interface NearestStoreResult {
  store: { id: string; name: string; slug?: string; deliveryFee?: number; minOrderAmount?: number }
  distance?: number
  deliveryFee?: number
  minOrderAmount?: number
}

/**
 * On mount, requests GPS from the browser and resolves the nearest store for
 * the current business. Sets currentStoreId and cartStoreId automatically.
 * Silently no-ops if geolocation is unavailable or businessId is not yet set.
 */
export function useNearestStore() {
  const { currentBusinessId, currentStoreId, setCurrentStoreId } = useAdminStore()
  const { setCartStoreId } = useCartStore()
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (!currentBusinessId) return
    // Only auto-resolve once per mount; don't override a storeId already set
    // (e.g. by subdomain detection via StorefrontParamDetector)
    if (currentStoreId || resolvedRef.current) return
    if (!navigator.geolocation) return

    resolvedRef.current = true

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        fetch(
          `/api/core/storefront/nearest-store?businessId=${encodeURIComponent(currentBusinessId)}&lat=${lat}&lng=${lng}`
        )
          .then((r) => r.json())
          .then((json) => {
            if (!json.success || !json.data?.store?.id) return
            const result = json.data as NearestStoreResult
            setCurrentStoreId(result.store.id)
            setCartStoreId(result.store.id)
          })
          .catch(() => {/* non-fatal */})
      },
      () => {/* permission denied or unavailable — silent fallback */},
      { timeout: 8000, maximumAge: 300_000 }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId])
}
