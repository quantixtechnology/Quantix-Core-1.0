// ============================================================================
// CHECK: Maps JavaScript API
// Probes the Maps JS bootstrap the storefront/admin loaders use. A loadable
// bootstrap with no embedded config error = the core Maps JS API is serving.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probeMapsJs } from "../google-probes"
import { classifyGoogleError, statusSummary, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "maps-js",
  label: "Maps JavaScript API",
  apiName: "Maps JavaScript API",
  docsLink: GOOGLE_DOCS.mapsJs,
  async run(ctx) {
    const probe = await probeMapsJs(ctx.apiKey, ctx.requestOrigin ?? ctx.allowedOrigins[0], ctx.signal)
    if (probe.ok) {
      return {
        id: "maps-js",
        label: "Maps JavaScript API",
        status: "healthy",
        summary: "Healthy",
        detail: "The Maps JavaScript bootstrap loaded without any embedded config error (invalid key, referrer, billing, or unactivated API).",
        apiName: "Maps JavaScript API",
        docsLink: GOOGLE_DOCS.mapsJs,
        data: { httpStatus: probe.httpStatus },
      }
    }
    const classified = classifyGoogleError(probe.errorMessage)
    return {
      id: "maps-js",
      label: "Maps JavaScript API",
      status: "error",
      summary: statusSummary(probe.status ?? "ERROR"),
      detail: probe.errorMessage ?? "Maps JavaScript API is not responding.",
      googleErrorCode: probe.status ?? undefined,
      googleErrorMessage: probe.errorMessage ?? undefined,
      apiName: classified?.apiName ?? "Maps JavaScript API",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.mapsJs,
      data: { httpStatus: probe.httpStatus, raw: probe.raw },
    }
  },
})
