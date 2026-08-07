"use client"

// Transport Setup (Workspace Settings) for the current business — the single
// client-side source every transport screen reads before it renders, scans or
// prints anything. One in-flight fetch per business is shared across screens.

import { useEffect, useState } from "react"
import {
  DEFAULT_TRANSPORT_MODES, normalizeTransportModes, type TransportModes,
} from "@/lib/laundry-transport"

const cache = new Map<string, TransportModes>()
const inflight = new Map<string, Promise<TransportModes>>()

async function fetchModes(businessId: string): Promise<TransportModes> {
  const cached = cache.get(businessId)
  if (cached) return cached
  const existing = inflight.get(businessId)
  if (existing) return existing
  const p = fetch(`/api/laundry/transport-settings?businessId=${encodeURIComponent(businessId)}`)
    .then((r) => r.json())
    .then((j) => {
      const modes = j?.success ? normalizeTransportModes(j.data) : DEFAULT_TRANSPORT_MODES
      cache.set(businessId, modes)
      return modes
    })
    .catch(() => DEFAULT_TRANSPORT_MODES)
    .finally(() => { inflight.delete(businessId) })
  inflight.set(businessId, p)
  return p
}

/** Drop the cached modes so the next read reflects a just-saved setting. */
export function invalidateTransportModes(businessId?: string) {
  if (businessId) cache.delete(businessId)
  else cache.clear()
}

export function useTransportModes(businessId: string | null | undefined): TransportModes & { loading: boolean } {
  const [modes, setModes] = useState<TransportModes>(() => (businessId && cache.get(businessId)) || DEFAULT_TRANSPORT_MODES)
  const [loading, setLoading] = useState(!(businessId && cache.has(businessId)))

  useEffect(() => {
    if (!businessId) return
    let alive = true
    // fetchModes resolves from the cache without a request, but always
    // asynchronously — so state only ever settles in a callback.
    fetchModes(businessId).then((m) => { if (alive) { setModes(m); setLoading(false) } })
    return () => { alive = false }
  }, [businessId])

  return { ...modes, loading }
}
