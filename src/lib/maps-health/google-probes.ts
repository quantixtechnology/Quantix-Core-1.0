// ============================================================================
// QUANTIX CORE — Google Maps Platform Health Monitor (HTTP probes)
//
// Direct server-side probes to the SAME Google endpoints the browser Maps JS
// client calls. This is what makes the monitor work without a headless browser
// and without any app-code instrumentation:
//
//   • Maps JS bootstrap  https://maps.googleapis.com/maps/api/js?... (JS blob)
//   • Places autocomplete /place/autocomplete/json  (places + legacy token)
//   • Forward geocode    /geocode/json?address=     (Geocoding API)
//   • Reverse geocode    /geocode/json?latlng=      (Geocoding API)
//
// All endpoints return HTTP 200 with a JSON/JS body containing a status code
// and error message — the raw evidence the DETAILS panel needs.
// ============================================================================

export interface GoogleProbeResult {
  /** True when the call was answered by Google with an evaluable response. */
  ok: boolean
  /** Google service status ("OK" | "REQUEST_DENIED" | …) or null. */
  status: string | null
  /** Raw Google error_message, if any. */
  errorMessage: string | null
  /** First prediction/result string, when the probe succeeded. */
  sample?: string | null
  /** HTTP status, when distinguishable. */
  httpStatus?: number
  /** Truncated raw body for forensic evidence. */
  raw?: string
}

const MAPS_JS_URL = "https://maps.googleapis.com/maps/api/js"
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
const AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"

const DEFAULT_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Google request timed out")), ms)
    promise.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

function truncate(text: string, max = 600): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function parseJsonBody(text: string): { status: string | null; errorMessage: string | null; sample: string | null } {
  let status: string | null = null
  let errorMessage: string | null = null
  let sample: string | null = null
  try {
    const json = JSON.parse(text)
    if (typeof json.status === "string") status = json.status
    if (typeof json.error_message === "string") errorMessage = json.error_message
    if (Array.isArray(json.predictions) && json.predictions.length > 0) {
      sample = json.predictions[0].description ?? json.predictions[0].formatted_address ?? null
    }
    if (Array.isArray(json.results) && json.results.length > 0) {
      sample = json.results[0].formatted_address ?? null
    }
  } catch {
    // Non-JSON body (e.g. Maps JS bootstrap) — handled by caller.
  }
  return { status, errorMessage, sample }
}

/** Probe the Maps JavaScript API bootstrap. */
export async function probeMapsJs(key: string, origin?: string | null, signal?: AbortSignal): Promise<GoogleProbeResult> {
  const url = `${MAPS_JS_URL}?key=${encodeURIComponent(key)}&libraries=places,geometry&v=weekly&callback=__gmpc`
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: origin ? { Referer: origin, "Accept-Language": "en" } : { "Accept-Language": "en" },
        signal,
      }),
      DEFAULT_TIMEOUT_MS,
    )
    const body = await res.text()
    // The bootstrap is a JS blob. Key/referrer/billing failures surface as
    // embedded error identifiers. A 200 + "callback" script = loadable.
    const err =
      body.match(/InvalidKeyMapError|MissingKeyMapError|RefererNotAllowedMapError|BillingNotEnabledMapError|ApiNotActivatedMapError/i)?.[0] ??
      null
    if (err) {
      return {
        ok: false,
        status: "REQUEST_DENIED",
        errorMessage: `${err}: the Maps JavaScript bootstrap returned an embedded config error.`,
        httpStatus: res.status,
        raw: truncate(body),
      }
    }
    return {
      ok: true,
      status: "OK",
      errorMessage: null,
      httpStatus: res.status,
      raw: truncate(body, 300),
    }
  } catch (e) {
    return {
      ok: false,
      status: null,
      errorMessage: e instanceof Error ? e.message : "Failed to reach Google Maps JS",
      httpStatus: 0,
    }
  }
}

/** Probe the legacy Places autocomplete endpoint. */
export async function probePlacesAutocomplete(
  key: string,
  input = "Hegde Nagar Bengaluru",
  origin?: string | null,
  signal?: AbortSignal,
): Promise<GoogleProbeResult> {
  const url = `${AUTOCOMPLETE_URL}?input=${encodeURIComponent(input)}&key=${encodeURIComponent(key)}&components=country:in&types=geocode`
  try {
    const res = await withTimeout(
      fetch(url, { headers: origin ? { Referer: origin } : undefined, signal }),
      DEFAULT_TIMEOUT_MS,
    )
    const body = await res.text()
    const parsed = parseJsonBody(body)
    return { ...parsed, ok: parsed.status === "OK", httpStatus: res.status, raw: truncate(body) }
  } catch (e) {
    return { ok: false, status: null, errorMessage: e instanceof Error ? e.message : "Failed to reach Places API", httpStatus: 0 }
  }
}

/** Probe the forward Geocoding API. */
export async function probeGeocode(
  key: string,
  address = "Hegde Nagar, Bengaluru, Karnataka",
  origin?: string | null,
  signal?: AbortSignal,
): Promise<GoogleProbeResult> {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`
  try {
    const res = await withTimeout(
      fetch(url, { headers: origin ? { Referer: origin } : undefined, signal }),
      DEFAULT_TIMEOUT_MS,
    )
    const body = await res.text()
    const parsed = parseJsonBody(body)
    return { ...parsed, ok: parsed.status === "OK", httpStatus: res.status, raw: truncate(body) }
  } catch (e) {
    return { ok: false, status: null, errorMessage: e instanceof Error ? e.message : "Failed to reach Geocoding API", httpStatus: 0 }
  }
}

/** Probe the reverse Geocoding API. */
export async function probeReverseGeocode(
  key: string,
  lat = 13.0436,
  lng = 77.5811,
  origin?: string | null,
  signal?: AbortSignal,
): Promise<GoogleProbeResult> {
  const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${encodeURIComponent(key)}`
  try {
    const res = await withTimeout(
      fetch(url, { headers: origin ? { Referer: origin } : undefined, signal }),
      DEFAULT_TIMEOUT_MS,
    )
    const body = await res.text()
    const parsed = parseJsonBody(body)
    return { ...parsed, ok: parsed.status === "OK", httpStatus: res.status, raw: truncate(body) }
  } catch (e) {
    return { ok: false, status: null, errorMessage: e instanceof Error ? e.message : "Failed to reach Geocoding API", httpStatus: 0 }
  }
}
