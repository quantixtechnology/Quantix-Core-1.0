"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

interface ServiceabilityPreviewProps {
  lat: number | null | undefined
  lng: number | null | undefined
  brandColor: string
  businessId?: string | null
}

interface SvcResult {
  serviceable: boolean
  nearestStore?: { name: string; distanceKm: number | null } | null
  reason?: string | null
}

/**
 * Live delivery-availability preview for the address picker. Debounced POST to
 * the serviceability engine whenever the selected lat/lng changes. Purely
 * informational — NEVER blocks saving an address.
 */
export function ServiceabilityPreview({ lat, lng, brandColor, businessId }: ServiceabilityPreviewProps) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ok" | "no"; data?: SvcResult; message?: string }>({ status: "idle" })

  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return
    let cancelled = false
    const timer = setTimeout(async () => {
      setState({ status: "loading" })
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
          return
        }
        setState({ status: data.serviceable ? "ok" : "no", data })
      } catch {
        if (!cancelled) setState({ status: "no", message: "Could not check delivery availability." })
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lat, lng, businessId])

  if (typeof lat !== "number" || typeof lng !== "number") return null

  if (state.status === "idle") return null

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">Checking delivery availability…</span>
      </div>
    )
  }

  const store = state.data?.nearestStore

  if (state.status === "ok") {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100">
        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-green-700">Service available</p>
          {store && (
            <p className="text-[11px] text-green-600 leading-snug">
              We deliver here from {store.name}
              {typeof store.distanceKm === "number" ? ` (${store.distanceKm.toFixed(1)} km)` : ""}.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-amber-700">Outside the current service area</p>
        {store && (
          <p className="text-[11px] text-amber-600 leading-snug">
            Nearest {store.name}
            {typeof store.distanceKm === "number" ? ` is ${store.distanceKm.toFixed(1)} km away` : ""}. You can still
            save this address, but delivery may not be available here yet.
          </p>
        )}
        {!store && <p className="text-[11px] text-amber-600 leading-snug">{state.message || "Delivery may not be available at this location."}</p>}
      </div>
    </div>
  )
}
