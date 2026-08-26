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
    /** Google calls this when the key or its referrer restriction is rejected. */
    gm_authFailure?: () => void
  }
}

// RefererNotAllowedMapError (and InvalidKeyMapError) do NOT fail the script
// request: the bootstrap downloads fine and returns 200, so the `load` event
// fires and every caller believes Maps is ready. Google rejects the referrer
// afterwards and calls window.gm_authFailure().
//
// Without watching for that, a picker sits on "Resolving location…" for ever
// with Save disabled — the page looks broken and says nothing true. This turns
// it into a normal load failure, which every caller already handles.
let authFailed = false

/** Did Google reject this key/referrer? Then no Maps call will ever work here. */
export function isMapsAuthFailed(): boolean {
  return authFailed
}

export function loadGoogleMaps(): Promise<GoogleNamespace> {
  if (authFailed) return Promise.reject(new Error("GOOGLE_MAPS_AUTH_FAILED"))
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
      resolve(window.google)
      return
    }

    const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true })
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true })
      return
    }

    // Installed BEFORE the script so a rejection cannot be missed.
    const previous = window.gm_authFailure
    window.gm_authFailure = () => {
      authFailed = true
      googlePromise = null // let a later attempt re-try rather than reuse this
      reject(new Error("GOOGLE_MAPS_AUTH_FAILED"))
      try { previous?.() } catch { /* someone else's handler is not our problem */ }
    }

    const script = document.createElement("script")
    script.id = "google-maps-script"
    script.src = `${MAPS_URL}?key=${encodeURIComponent(key)}&libraries=places,geometry&v=weekly`
    script.async = true
    script.defer = true
    script.addEventListener("load", () => {
      // gm_authFailure can fire either side of this; check before claiming success.
      if (authFailed) reject(new Error("GOOGLE_MAPS_AUTH_FAILED"))
      else resolve(window.google)
    }, { once: true })
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true })
    document.head.appendChild(script)
  })

  return googlePromise
}
