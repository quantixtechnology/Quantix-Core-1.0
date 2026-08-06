// ============================================================================
// QUANTIX CORE — Google Maps Platform Health Monitor (error catalog)
//
// Maps the known Google error signatures the Maps JS bootstrap and JSON/REST
// endpoints emit onto structured remediation guidance. Every entry carries the
// Google error code/message plus the fix + docs link the UI must render.
//
// This is a catalog of KNOWN failures only. Unrecognized responses fall through
// to a generic classification — the check framework never assumes "healthy".
// ============================================================================

import type { GoogleErrorClassification } from "./types"

interface CatalogEntry {
  /** Regex matched against the raw Google error message. */
  match: RegExp
  apiName: string
  suggestedFix: string
  docsLink: string
}

// Official Google docs URLs (stable, product-scoped).
export const GOOGLE_DOCS = {
  legacyApi: "https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError",
  apiLibrary: "https://console.cloud.google.com/apis/library?filter=category:maps",
  billing: "https://console.cloud.google.com/billing",
  billingHelp: "https://developers.google.com/maps/billing-and-pricing/billing",
  keys: "https://developers.google.com/maps/gmp-get-started#creating-api-keys",
  referer: "https://developers.google.com/maps/api-security-best-practices#restricting_api_keys_with_http_referrers",
  invalidKey: "https://developers.google.com/maps/documentation/javascript/error-messages#invalid-key-or-unauthorized-url",
  quota: "https://developers.google.com/maps/billing-and-pricing/pricing",
  geocoding: "https://developers.google.com/maps/documentation/geocoding/overview",
  places: "https://developers.google.com/maps/documentation/places/web-service/overview",
  mapsJs: "https://developers.google.com/maps/documentation/javascript/overview",
} as const

// Ordered; first match wins. Core config failures (invalid key, billing,
// referrer) are exact and cheap — put them before per-API "not enabled".
const CATALOG: CatalogEntry[] = [
  {
    match: /invalid.*key|key.*invalid|invalidkey|forbidden.*key|INVALID_KEY/i,
    apiName: "Browser API Key",
    suggestedFix:
      "The API key embedded in the build is invalid. Generate a new Google Maps API key in Google Cloud Console, update NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, and redeploy.",
    docsLink: GOOGLE_DOCS.invalidKey,
  },
  {
    match: /referer.*blocked|referernotallowed|requests from referer/i,
    apiName: "HTTP Referrer",
    suggestedFix:
      "The storefront/admin origin is not in the key's HTTP Referrer allow-list. Add https://laundrydrycleaners.quantixtechnology.in/ and https://laundry.quantixtechnology.in/ to the key restrictions in Google Cloud Console.",
    docsLink: GOOGLE_DOCS.referer,
  },
  {
    match: /billing|BillingNotEnabled|not enabled on.*project.*billing/i,
    apiName: "Billing",
    suggestedFix:
      "Google Maps Platform requires a billing account linked to the project. Enable billing on GCP project 251402262956 in Google Cloud Console.",
    docsLink: GOOGLE_DOCS.billingHelp,
  },
  {
    match: /legacy api|legacyapi|you'?re calling a legacy/i,
    apiName: "Places API",
    suggestedFix:
      "A legacy Google API was called. The app now uses the Places API (New) via AutocompleteSuggestion/Place.fetchFields — ensure the code path does not construct google.maps.places.Autocomplete.",
    docsLink: GOOGLE_DOCS.legacyApi,
  },
  {
    match: /not activated on your api project|not enabled for|is not enabled|has not been used in project.*before/i,
    apiName: "Google Maps Platform API",
    suggestedFix:
      "The required Google Maps Platform API is not enabled for GCP project 251402262956. Enable it in Google Cloud Console → APIs & Services → Library.",
    docsLink: GOOGLE_DOCS.apiLibrary,
  },
  {
    match: /over_query_limit|resource_exhausted|quota/i,
    apiName: "Quota / Billing",
    suggestedFix:
      "Daily/ per-minute quota exceeded or billing credit exhausted. Check quota usage and billing in Google Cloud Console; requests will resume on the next quota window.",
    docsLink: GOOGLE_DOCS.quota,
  },
  {
    match: /missing key|missingkey|no api key/i,
    apiName: "Browser API Key",
    suggestedFix:
      "No API key was passed to the Maps loader. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the build environment and redeploy.",
    docsLink: GOOGLE_DOCS.keys,
  },
  {
    match: /request_denied/i,
    apiName: "Google Maps Platform API",
    suggestedFix:
      "The Google Maps request was denied (REQUEST_DENIED). Check the full error message in the DETAILS panel and enable the corresponding API for project 251402262956.",
    docsLink: GOOGLE_DOCS.apiLibrary,
  },
]

/** Classify a raw Google error message into remediation guidance. */
export function classifyGoogleError(errorMessage?: string | null): GoogleErrorClassification | null {
  if (!errorMessage) return null
  for (const entry of CATALOG) {
    if (entry.match.test(errorMessage)) {
      return { apiName: entry.apiName, suggestedFix: entry.suggestedFix, docsLink: entry.docsLink }
    }
  }
  return null
}

/** Short human label for a Google service status code. */
export function statusSummary(status: string): string {
  const known: Record<string, string> = {
    OK: "Healthy",
    REQUEST_DENIED: "Denied",
    ZERO_RESULTS: "No results",
    OVER_QUERY_LIMIT: "Quota exceeded",
    INVALID_REQUEST: "Invalid request",
    NOT_FOUND: "Not found",
    UNKNOWN_ERROR: "Unknown error",
  }
  return known[status] ?? status
}
