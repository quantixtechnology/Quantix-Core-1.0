// ============================================================================
// CHECK: Reverse Geocoder
// Functional reverse-geocode probe (what the address picker runs to turn a pin
// into a saved address). Requires the Geocoding API.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probeReverseGeocode } from "../google-probes"
import { classifyGoogleError, statusSummary, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "reverse-geocoder",
  label: "Reverse Geocoder",
  apiName: "Geocoding API (Reverse)",
  docsLink: GOOGLE_DOCS.geocoding,
  async run(ctx) {
    // Hegde Nagar, Bengaluru reference pin — the exact coords the app's
    // reverse-geocoder resolves when a customer drops a pin there.
    const probe = await probeReverseGeocode(
      ctx.apiKey,
      13.0436,
      77.5811,
      ctx.requestOrigin ?? ctx.allowedOrigins[0],
      ctx.signal,
    )
    if (probe.ok) {
      return {
        id: "reverse-geocoder",
        label: "Reverse Geocoder",
        status: "healthy",
        summary: "Working",
        detail: `Reverse geocoding resolved reference coordinates${probe.sample ? ` ("${probe.sample}")` : ""}, so dropping a pin can produce a saveable address.`,
        apiName: "Geocoding API (Reverse)",
        docsLink: GOOGLE_DOCS.geocoding,
        data: { sample: probe.sample },
      }
    }
    const classified = classifyGoogleError(probe.errorMessage)
    return {
      id: "reverse-geocoder",
      label: "Reverse Geocoder",
      status: "error",
      summary: statusSummary(probe.status ?? "Failed"),
      detail: probe.errorMessage ?? "Reverse geocoding failed for reference coordinates.",
      googleErrorCode: probe.status ?? "REQUEST_DENIED",
      googleErrorMessage: probe.errorMessage ?? "Reverse geocoder could not resolve the coordinates.",
      apiName: classified?.apiName ?? "Geocoding API (Reverse)",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.geocoding,
      data: { raw: probe.raw },
    }
  },
})