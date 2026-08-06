// ============================================================================
// CHECK: Places Autocomplete
// Functional end-to-end autocomplete probe (what the address picker's
// Autocomplete widget does). Duplicates places-api at the workflow level so a
// failure in the search box itself is caught even when the API is enabled.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probePlacesAutocomplete } from "../google-probes"
import { classifyGoogleError, statusSummary, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "places-autocomplete",
  label: "Places Autocomplete",
  apiName: "Places API (Autocomplete)",
  docsLink: GOOGLE_DOCS.places,
  async run(ctx) {
    const probe = await probePlacesAutocomplete(
      ctx.apiKey,
      "Hegde Nagar, Bengaluru",
      ctx.requestOrigin ?? ctx.allowedOrigins[0],
      ctx.signal,
    )
    if (probe.ok) {
      return {
        id: "places-autocomplete",
        label: "Places Autocomplete",
        status: "healthy",
        summary: "Working",
        detail: `Autocomplete returned suggestions for a real query${probe.sample ? ` (e.g. "${probe.sample}")` : ""}.`,
        apiName: "Places API (Autocomplete)",
        docsLink: GOOGLE_DOCS.places,
        data: { sample: probe.sample },
      }
    }
    const classified = classifyGoogleError(probe.errorMessage)
    return {
      id: "places-autocomplete",
      label: "Places Autocomplete",
      status: "error",
      summary: statusSummary(probe.status ?? "Failed"),
      detail: probe.errorMessage ?? "Autocomplete failed for a sample query.",
      googleErrorCode: probe.status ?? "REQUEST_DENIED",
      googleErrorMessage: probe.errorMessage ?? "Places Autocomplete failed.",
      apiName: classified?.apiName ?? "Places API (Autocomplete)",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.places,
      data: { raw: probe.raw },
    }
  },
})