// ============================================================================
// CHECK: Places API
// Verifies autocomplete reachability. The app's address pickers use the Places
// API (New) via AutocompleteSuggestion/Place.fetchFields — NOT the legacy
// google.maps.places.Autocomplete widget. The legacy REST probe below only
// surfaces REQUEST_DENIED when the old endpoint is blocked (irrelevant to the
// New Places API path).
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
        detail: `Places autocomplete returned results for a sample query${probe.sample ? ` ("${probe.sample}")` : ""}.`,
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