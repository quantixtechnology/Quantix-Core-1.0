"use client"

// useGarmentSearch — the workstation search box, race-safe.
//
// THE FLICKER THIS FIXES.
//
// Search used to be a dependency of the workstation's queue loader, which is
// ALSO driven by a 12-second auto-refresh. So typing raced the poll, every
// keystroke raced the keystroke before it, and whichever response landed last
// won — including a stale one. Typing "GAR000000000331" could end up rendering
// the answer to "GAR0".
//
// Two rules make it deterministic:
//
//   1. Search is its OWN request, not part of the queue load. The poll refreshes
//      the queue; it can never overwrite a search result, and a search can never
//      blank the queue.
//   2. Every search carries a generation number and an AbortController. Only the
//      newest generation may write state. An older response that arrives late is
//      dropped on the floor — it cannot call setResults, cannot flash the old
//      list back, and cannot reset the box.
//
// The hook owns no queue state and performs no writes: searching is read-only.

import { useCallback, useEffect, useRef, useState } from "react"

export interface GarmentHit {
  id: string
  garmentScanCode: string | null
  itemNumber: string | null
  barcode: string | null
  garmentName: string
  serviceName: string | null
  quantity: number
  orderId: string
  orderNumber: string
  orderStatus: string
  processingStage: string | null
  processingStatus: string | null
  stageLabel: string
  department: string | null
}

export interface GarmentSearchState {
  /** The raw box value — always what the user typed, never overwritten async. */
  query: string
  setQuery: (v: string) => void
  clear: () => void
  /** True while a search is genuinely active (trimmed, non-empty). */
  active: boolean
  results: GarmentHit[]
  /** In flight. Drives a small inline indicator — never the page spinner. */
  loading: boolean
  error: string | null
  truncated: boolean
  /** Re-run the current search against the server (after an action). */
  refresh: () => void
}

const DEBOUNCE_MS = 250

export function useGarmentSearch(businessId: string | null): GarmentSearchState {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GarmentHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [nonce, setNonce] = useState(0)

  // The generation of the most recently STARTED search. A response may only
  // write state if it still owns this number.
  const gen = useRef(0)
  const inflight = useRef<AbortController | null>(null)

  const trimmed = query.trim()
  const active = trimmed.length > 0

  useEffect(() => {
    // Cleared box → drop everything immediately, cancel anything in flight, and
    // do not leave a stale result behind for the next search to flash.
    if (!active || !businessId) {
      inflight.current?.abort()
      inflight.current = null
      gen.current++            // invalidate any response still on its way
      setResults([])
      setLoading(false)
      setError(null)
      setTruncated(false)
      return
    }

    const mine = ++gen.current
    const controller = new AbortController()
    inflight.current?.abort()  // the previous keystroke's request is now moot
    inflight.current = controller
    setLoading(true)

    const t = setTimeout(async () => {
      try {
        const url = `/api/laundry/processing/find?businessId=${encodeURIComponent(businessId)}&q=${encodeURIComponent(trimmed)}`
        const res = await fetch(url, { signal: controller.signal })
        const j = await res.json()
        // STALE GUARD: a newer keystroke started while this was in flight.
        if (mine !== gen.current) return
        if (!j.success) { setError(j.error || "Search failed"); setResults([]); setTruncated(false) }
        else { setResults(j.data || []); setTruncated(!!j.truncated); setError(null) }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return  // superseded — not a failure
        if (mine !== gen.current) return
        setError("Search failed")
        setResults([])
      } finally {
        if (mine === gen.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => { clearTimeout(t); controller.abort() }
  }, [trimmed, active, businessId, nonce])

  const clear = useCallback(() => setQuery(""), [])
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  return { query, setQuery, clear, active, results, loading, error, truncated, refresh }
}
