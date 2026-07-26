"use client"

import { useEffect, useRef } from "react"

// Keep an operational queue fresh without a manual page refresh.
//
// Re-runs `load` when the tab regains focus / becomes visible (so switching to
// another screen, doing a scan, and coming back shows the updated queue), and —
// when `intervalMs` is set — on a light background poll (so a change made on
// ANOTHER screen or by another operator appears on its own within a few seconds).
//
// The callback is held in a ref so a fresh closure each render never re-arms the
// listeners/timer. Never fires while the tab is hidden.
export function useAutoRefresh(load: () => void, opts: { intervalMs?: number; enabled?: boolean } = {}) {
  const { intervalMs = 0, enabled = true } = opts
  const ref = useRef(load)
  ref.current = load

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return
    const fire = () => { if (document.visibilityState !== "hidden") ref.current() }
    window.addEventListener("focus", fire)
    document.addEventListener("visibilitychange", fire)
    const id = intervalMs > 0 ? setInterval(fire, intervalMs) : undefined
    return () => {
      window.removeEventListener("focus", fire)
      document.removeEventListener("visibilitychange", fire)
      if (id) clearInterval(id)
    }
  }, [enabled, intervalMs])
}
