// ============================================================================
// CHECK: Places API
// Verifies the legacy Places API is enabled. The app's address picker uses
// google.maps.places.Autocomplete, which requires the legacy Places API.
// Probing the same autocomplete REST endpoint surfaces the exact REQUEST_DENIED
// "legacy API not enabled" message when it is missing.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probePlacesAutocomplete } from "../google-probes"
import { classifyGoogleError, statusSummary, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "places-api",
  label: "Places API",
  apiName: "Places API",
  docsLink: GOOGLE_DOCS.places,
  async run(ctx) {
    const probe = await probePlacesAutocomplete(
      ctx.apiKey,
      "Hegde Nagar Bengaluru",
      ctx.requestOrigin ?? ctx.allowedOrigins[0],
      ctx.signal,
    )
    if (probe.ok) {
      return {
        id: "places-api",
        label: "Places API",
        status: "healthy",
        summary: "Enabled",
        detail: `Places autocomplete returned results for a sample query${probe.sample ? ` ("${probe.sample}")` : ""}. The legacy Places API is enabled.`,
        apiName: "Places API",
        docsLink: GOOGLE_DOCS.places,
        data: { sample: probe.sample },
      }
    }
    const classified = classifyGoogleError(probe.errorMessage)
    return {
      id: "places-api",
      label: "Places API",
      status: "error",
      summary: statusSummary(probe.status ?? "ERROR"),
      detail: probe.errorMessage ?? "Places API is not returning predictions for a sample query.",
      googleErrorCode: probe.status ?? "REQUEST_DENIED",
      googleErrorMessage: probe.errorMessage ?? "Places API returned no predictions.",
      apiName: classified?.apiName ?? "Places API",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.legacyApi,
      data: { raw: probe.raw },
    }
  },
})