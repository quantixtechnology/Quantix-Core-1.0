// ============================================================================
// QUANTIX CORE — Google Maps Platform Health Monitor (types)
//
// Modular, pluggable framework. Any future Google API / integration plugs in
// by registering a `HealthCheck` — no changes to the runner or callers.
// ============================================================================

export type HealthStatus = "healthy" | "warning" | "error" | "skipped"

/** A single health-check result, normalized so the UI needs zero Google knowledge. */
export interface HealthCheckResult {
  /** Stable check id — used for keys, ordering, and future persistence. */
  id: string
  /** Human label shown in the UI ("Places API", "Browser API Key", …). */
  label: string
  status: HealthStatus
  /** One-line summary ("Healthy", "Disabled", "Valid", …). */
  summary: string
  /** Optional longer diagnostic narrative for the DETAILS panel. */
  detail?: string
  // ── DETAILS (spec: every failed item must display these) ──
  googleErrorCode?: string
  googleErrorMessage?: string
  apiName?: string
  suggestedFix?: string
  docsLink?: string
  /** Duration of the probe, for diagnostics. */
  durationMs?: number
  /** Free-form extra evidence (raw response, store list, etc.). */
  data?: unknown
}

/** Context every check receives — keyed off config, never hardcoded per API. */
export interface HealthCheckContext {
  /** The Maps API key in use (browser key, baked into the build). */
  apiKey: string
  /** Origins the key should allow (storefront + admin). Empty = unverifiable. */
  allowedOrigins: string[]
  /** The origin the admin request came from, if known. */
  requestOrigin?: string | null
  signal?: AbortSignal
}

/** The pluggable unit. New integrations implement + register one of these. */
export interface HealthCheck {
  id: string
  label: string
  /** Which Google API/product this validates (for DETAILS display). */
  apiName?: string
  /** Official Google documentation for this product. */
  docsLink?: string
  run(ctx: HealthCheckContext): Promise<HealthCheckResult>
}

/** Classified Google error → human remediation guidance. */
export interface GoogleErrorClassification {
  apiName: string
  suggestedFix: string
  docsLink: string
}

/** Aggregate report returned to the admin page. */
export interface MapsHealthReport {
  generatedAt: string
  keyConfigured: boolean
  checks: HealthCheckResult[]
  /** Per-store verification (lat/lng/radii/address/placeId). */
  stores: StoreHealthRow[]
  /** Live serviceability sample runs. */
  serviceability: ServiceabilitySample[]
  summary: {
    total: number
    healthy: number
    warning: number
    error: number
    skipped: number
  }
}

/** One store's field-level verification row. */
export interface StoreHealthRow {
  storeId: string
  kind: "store" | "laundryStore"
  businessId: string
  businessName: string
  name: string
  fields: {
    latitude: boolean
    longitude: boolean
    deliveryRadius: boolean
    pickupRadius: boolean
    address: boolean
    placeId: boolean
  }
  /** Names of the fields that are missing/empty (→ warning). */
  missing: string[]
  complete: boolean
}

/** One live serviceability sample run. */
export interface ServiceabilitySample {
  businessId: string
  businessName: string
  storeId: string
  storeName: string
  storeLat: number
  storeLng: number
  customerLabel: string
  customerLat: number
  customerLng: number
  distanceKm: number
  radiusKm: number
  inside: boolean
  serviceable: boolean
  reason?: string | null
}
