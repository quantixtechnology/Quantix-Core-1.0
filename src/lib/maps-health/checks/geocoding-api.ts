// ============================================================================
// CHECK: Geocoding API
// Verifies the Geocoding API (forward) is enabled. Used by the storefront
// reverse-geocoder and store/address resolution.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probeGeocode } from "../google-probes"
import { classifyGoogleError, statusSummary, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "geocoding-api",
  label: "Geocoding API",
  apiName: "Geocoding API",
  docsLink: GOOGLE_DOCS.geocoding,
  async run(ctx) {
    const probe = await probeGeocode(
      ctx.apiKey,
      "Hegde Nagar, Bengaluru, Karnataka",
      ctx.requestOrigin ?? ctx.allowedOrigins[0],
      ctx.signal,
    )
    if (probe.ok) {
      return {
        id: "geocoding-api",
        label: "Geocoding API",
        status: "healthy",
        summary: "Enabled",
        detail: `Forward geocoding resolved a sample address${probe.sample ? ` ("${probe.sample}")` : ""}. The Geocoding API is enabled.`,
        apiName: "Geocoding API",
        docsLink: GOOGLE_DOCS.geocoding,
        data: { sample: probe.sample },
      }
    }
    const classified = classifyGoogleError(probe.errorMessage)
    return {
      id: "geocoding-api",
      label: "Geocoding API",
      status: "error",
      summary: statusSummary(probe.status ?? "ERROR"),
      detail: probe.errorMessage ?? "Forward geocoding failed for a sample address.",
      googleErrorCode: probe.status ?? "REQUEST_DENIED",
      googleErrorMessage: probe.errorMessage ?? "Geocoding API could not resolve the sample address.",
      apiName: classified?.apiName ?? "Geocoding API",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.geocoding,
      data: { raw: probe.raw },
    }
  },
})