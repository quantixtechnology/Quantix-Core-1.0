// ============================================================================
// CHECK: Billing
// Google reports billing problems via the Maps JS bootstrap (BillingNotEnabled)
// and via JSON endpoint error messages. This check aggregates those signals.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probeMapsJs, probeGeocode } from "../google-probes"
import { classifyGoogleError, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "billing",
  label: "Billing",
  apiName: "Billing",
  docsLink: GOOGLE_DOCS.billingHelp,
  async run(ctx) {
    const [bootstrap, geocode] = await Promise.all([
      probeMapsJs(ctx.apiKey, ctx.requestOrigin ?? ctx.allowedOrigins[0], ctx.signal),
      probeGeocode(ctx.apiKey, "Hegde Nagar, Bengaluru", ctx.requestOrigin ?? ctx.allowedOrigins[0], ctx.signal),
    ])
    const billingSignal =
      (bootstrap.errorMessage && /billing/i.test(bootstrap.errorMessage)) ||
      (geocode.errorMessage && /billing/i.test(geocode.errorMessage)) ||
      (geocode.errorMessage && /resource_exhausted/i.test(geocode.errorMessage))

    if (!billingSignal) {
      return {
        id: "billing",
        label: "Billing",
        status: "healthy",
        summary: "Enabled",
        detail:
          "No billing-related error surfaced from the Maps bootstrap or the Geocoding API probe. Billing is either enabled or not yet the blocking failure.",
        apiName: "Billing",
        docsLink: GOOGLE_DOCS.billingHelp,
      }
    }

    const classified = classifyGoogleError(geocode.errorMessage ?? bootstrap.errorMessage)
    return {
      id: "billing",
      label: "Billing",
      status: "error",
      summary: "Disabled",
      detail: (geocode.errorMessage ?? bootstrap.errorMessage) ?? "Billing error surfaced.",
      googleErrorCode: "BILLING_NOT_ENABLED",
      googleErrorMessage: (geocode.errorMessage ?? bootstrap.errorMessage) ?? "Billing must be enabled on the Google Cloud project.",
      apiName: classified?.apiName ?? "Billing",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.billingHelp,
    }
  },
})
