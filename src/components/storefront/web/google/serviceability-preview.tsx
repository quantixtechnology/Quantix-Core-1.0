"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertTriangle, MapPin } from "lucide-react"

interface ServiceabilityPreviewProps {
  lat: number | null | undefined
  lng: number | null | undefined
  brandColor: string
  businessId?: string | null
  /** Reports calculation state so the caller can gate the Save button. */
  onStatus?: (status: "idle" | "loading" | "done") => void
}

interface SvcResult {
  serviceable: boolean
  nearestStore?: {
    name: string
    distanceKm: number | null
    serviceRadiusKm?: number | null
  } | null
  reason?: string | null
}

/**
 * Live delivery-availability preview for the address picker. Debounced POST to
 * the serviceability engine whenever the selected lat/lng changes. Always shows
 * Distance, Store Radius and Status so the customer is never left guessing.
 *
 * `onStatus` lets the parent disable Save until the calculation has completed —
 * the address can never be saved while the availability result is stale.
 */
export function ServiceabilityPreview({ lat, lng, brandColor, businessId, onStatus }: ServiceabilityPreviewProps) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ok" | "no"; data?: SvcResult; message?: string }>({ status: "idle" })

  useEffect(() => {
    onStatus?.("idle")
    if (typeof lat !== "number" || typeof lng !== "number") return
    let cancelled = false
    onStatus?.("loading")
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/core/storefront/serviceability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: businessId || undefined, lat, lng }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setState({ status: "no", message: data.error || "Could not check delivery availability." })
          onStatus?.("done")
          return
        }
        setState({ status: data.serviceable ? "ok" : "no", data })
        onStatus?.("done")
      } catch {
        if (!cancelled) {
          setState({ status: "no", message: "Could not check delivery availability." })
          onStatus?.("done")
        }
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lat, lng, businessId, onStatus])

  if (typeof lat !== "number" || typeof lng !== "number") return null

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Checking delivery availability…</span>
      </div>
    )
  }

  if (state.status === "idle") return null

  const store = state.data?.nearestStore
  const distanceKm = typeof store?.distanceKm === "number" ? store.distanceKm : null
  const radiusKm = typeof store?.serviceRadiusKm === "number" ? store.serviceRadiusKm : null

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  )

  if (state.status === "ok") {
    return (
      <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-xs font-bold text-green-700">Delivery available</p>
        </div>
        {store && (
          <div className="rounded-lg bg-white/70 border border-green-100 px-2.5 py-1.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <MapPin className="w-3 h-3 shrink-0 text-green-600" />
              <span className="font-semibold truncate">{store.name}</span>
            </div>
            {distanceKm != null && row("Distance", `${distanceKm.toFixed(1)} km`)}
            {radiusKm != null && row("Store radius", `${radiusKm.toFixed(1)} km`)}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500">Status</span>
              <span className="font-bold text-green-700">✓ Inside service area</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs font-bold text-amber-700">Outside the current service area</p>
      </div>
      {store && (
        <div className="rounded-lg bg-white/70 border border-amber-100 px-2.5 py-1.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <MapPin className="w-3 h-3 shrink-0 text-amber-600" />
            <span className="font-semibold truncate">Nearest {store.name}</span>
          </div>
          {distanceKm != null && row("Distance", `${distanceKm.toFixed(1)} km`)}
          {radiusKm != null && row("Store radius", `${radiusKm.toFixed(1)} km`)}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Status</span>
            <span className="font-bold text-amber-700">Outside service area</span>
          </div>
        </div>
      )}
      {!store && (
        <p className="text-[11px] text-amber-600 leading-snug">
          {state.message || "Delivery may not be available at this location."}
        </p>
      )}
    </div>
  )
}