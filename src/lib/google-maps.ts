"use client"

// ============================================================================
// QUANTIX CORE — Google Maps loader (client-only singleton)
//
// Lazily loads the Google Maps JS API (core + places + geometry) exactly once
// and hands back a shared promise. Every map component awaits `loadGoogleMaps()`
// so multiple consumers never double-load the script.
//
// Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Without a key the UI falls back to
// manual address entry + GPS capture (still fully address-first).
// ============================================================================

const MAPS_URL = "https://maps.googleapis.com/maps/api/js"

export function hasGoogleMapsKey(): boolean {
  return !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleNamespace = any

let googlePromise: Promise<GoogleNamespace> | null = null

declare global {
  interface Window {
    google?: { maps?: unknown }
  }
}

export function loadGoogleMaps(): Promise<GoogleNamespace> {
  if (googlePromise) return googlePromise

  googlePromise = new Promise<GoogleNamespace>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("loadGoogleMaps must run client-side"))
      return
    }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) {
      reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured"))
      return
    }
    if (window.google?.maps) {
      resolve(window.google.maps)
      return
    }

    const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google?.maps), { once: true })
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = "google-maps-script"
    script.src = `${MAPS_URL}?key=${encodeURIComponent(key)}&libraries=places,geometry&v=weekly`
    script.async = true
    script.defer = true
    script.addEventListener("load", () => resolve(window.google?.maps), { once: true })
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true })
    document.head.appendChild(script)
  })

  return googlePromise
}
