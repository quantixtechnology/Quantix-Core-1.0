// Getting the browser's position, once, with the failures told apart.
//
// Deliberately small and deliberately SHARED: this logic existed in three
// copies (store picker, customer address picker, delivery sheet), each
// reporting every failure as "Location access denied". One copy was corrected
// and the other two were not — which is the argument for there being one.
//
// It returns COORDINATES ONLY. Nothing here knows about Google Maps; reverse
// geocoding is the caller's business and happens after a fix is in hand.
//
// ── kCLErrorLocationUnknown ────────────────────────────────────────────────
// On macOS, Chrome asks CoreLocation. CoreLocation answers
// kCLErrorLocationUnknown — surfaced as POSITION_UNAVAILABLE — when it cannot
// work out where the machine is *right now*. It is frequently transient: a Mac
// without GPS locates by scanning Wi-Fi, and the first attempt often lands
// before a scan has completed. So POSITION_UNAVAILABLE is retried a couple of
// times, briefly.
//
// A refusal is never retried: PERMISSION_DENIED is an answer, not a hiccup.

export type GeoErrorKind = "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED"

export interface GeoSuccess {
  ok: true
  latitude: number
  longitude: number
  accuracy: number | null
}
export interface GeoFailure {
  ok: false
  kind: GeoErrorKind
  /** Ready to show. */
  message: string
  /** The raw GeolocationPositionError code + message, for diagnostics. */
  detail: string
  attempts: number
}
export type GeoResult = GeoSuccess | GeoFailure

const MESSAGES: Record<GeoErrorKind, string> = {
  DENIED: "Location access denied.",
  UNAVAILABLE: "Unable to determine your location.",
  TIMEOUT: "Location request timed out.",
  UNSUPPORTED: "Location is not available on this device.",
}

const kindOf = (err: GeolocationPositionError): GeoErrorKind =>
  err.code === err.PERMISSION_DENIED ? "DENIED"
  : err.code === err.TIMEOUT ? "TIMEOUT"
  : "UNAVAILABLE"

const once = (options: PositionOptions): Promise<GeolocationPosition | GeolocationPositionError> =>
  new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, resolve, options))

export interface RequestCoordsOptions {
  /** Extra attempts after a POSITION_UNAVAILABLE. Default 2 (3 tries total). */
  retries?: number
  /** Pause between those attempts, ms. */
  retryDelayMs?: number
  timeoutMs?: number
  /** High accuracy costs time; the last attempt drops it to get *something*. */
  enableHighAccuracy?: boolean
}

export async function requestCoords(opts: RequestCoordsOptions = {}): Promise<GeoResult> {
  const { retries = 2, retryDelayMs = 700, timeoutMs = 15000, enableHighAccuracy = true } = opts

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, kind: "UNSUPPORTED", message: MESSAGES.UNSUPPORTED, detail: "navigator.geolocation is unavailable", attempts: 0 }
  }

  let last: GeolocationPositionError | null = null
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const isFinal = attempt === retries + 1
    const res = await once({
      // The final attempt asks for a coarse fix. A Wi-Fi/IP position is far
      // better than no position, and high accuracy is what usually fails here.
      enableHighAccuracy: enableHighAccuracy && !isFinal,
      timeout: timeoutMs,
      maximumAge: 60000,
    })

    if ("coords" in res) {
      return { ok: true, latitude: res.coords.latitude, longitude: res.coords.longitude, accuracy: res.coords.accuracy ?? null }
    }

    last = res
    const kind = kindOf(res)
    // Visible in DevTools so the real cause is never guessed at again.
    console.warn(`[geolocation] attempt ${attempt}/${retries + 1} failed — code ${res.code} (${kind}): ${res.message}`)

    // A refusal or a timeout is the answer; only "cannot tell right now" is
    // worth asking again.
    if (kind !== "UNAVAILABLE" || isFinal) break
    await new Promise((r) => setTimeout(r, retryDelayMs))
  }

  const kind = last ? kindOf(last) : "UNAVAILABLE"
  return {
    ok: false,
    kind,
    message: MESSAGES[kind],
    detail: last ? `code ${last.code}: ${last.message}` : "no position",
    attempts: retries + 1,
  }
}

/** The message plus what to do about it, for a picker that offers search + pin. */
export function geoMessageWithFallback(f: GeoFailure, what: "store" | "address"): string {
  const alt = what === "store" ? "Search for the store or drop a pin instead." : "Search for your address or drop a pin instead."
  return `${f.message} ${alt}`
}
