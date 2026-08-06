// ============================================================================
// CHECK: HTTP Referrer
// Verifies the key's HTTP Referrer restrictions allowlist the storefront &
// admin origins. The Maps JS bootstrap rejects bad referrers with
// RefererNotAllowedMapError; JSON endpoints return JSON_PROMO/JSON_PROMO/other
// referer messages. We probe with the real browser origin as the Referer.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probeMapsJs, probeGeocode } from "../google-probes"
import { classifyGoogleError, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "referrer",
  label: "HTTP Referrer",
  apiName: "HTTP Referrer",
  docsLink: GOOGLE_DOCS.referer,
  async run(ctx) {
    const origins = ctx.allowedOrigins.length ? ctx.allowedOrigins : []
    const refererSignal = (err?: string | null) => (err && /referer|blocked/i.test(err)) || false

    // Use the real browser origin first, else the first configured origin.
    const browserOrigin = ctx.requestOrigin ?? origins[0] ?? null
    const [bootstrap, geocode] = await Promise.all([
      probeMapsJs(ctx.apiKey, browserOrigin, ctx.signal),
      probeGeocode(ctx.apiKey, "Hegde Nagar, Bengaluru", browserOrigin, ctx.signal),
    ])

    const blocked = refererSignal(bootstrap.errorMessage) || refererSignal(geocode.errorMessage)

    if (!blocked) {
      return {
        id: "referrer",
        label: "HTTP Referrer",
        status: origins.length || browserOrigin ? "healthy" : "warning",
        summary: origins.length || browserOrigin ? "Allowed" : "Unverified",
        detail:
          origins.length || browserOrigin
            ? `No referer rejection from Google for origin ${browserOrigin ?? "(request origin)"}.`
            : "No storefront/admin origin was present and none could be probed, so the HTTP Referrer allow-list could not be verified.",
        apiName: "HTTP Referrer",
        docsLink: GOOGLE_DOCS.referer,
      }
    }

    const classified =
      classifyGoogleError(geocode.errorMessage ?? bootstrap.errorMessage) ?? null
    return {
      id: "referrer",
      label: "HTTP Referrer",
      status: "error",
      summary: "Blocked",
      detail:
        (geocode.errorMessage ?? bootstrap.errorMessage ?? "Google blocked the request for an unauthorised HTTP referrer.") +
        (browserOrigin ? ` Referer tested: ${browserOrigin}.` : ""),
      googleErrorCode: "REFERER_NOT_ALLOWED",
      googleErrorMessage:
        (geocode.errorMessage ?? bootstrap.errorMessage) ?? "The HTTP Referrer is not in the API key's allow-list.",
      apiName: classified?.apiName ?? "HTTP Referrer",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.referer,
      data: { testedOrigin: browserOrigin },
    }
  },
})