// ============================================================================
// CHECK: Browser API Key
// Validates the key the build embeds: present, non-empty, and accepted by the
// Maps JS bootstrap (invalid keys surface as InvalidKeyMapError).
// ============================================================================

import { registerHealthCheck } from "../registry"
import { probeMapsJs } from "../google-probes"
import { classifyGoogleError, GOOGLE_DOCS } from "../error-catalog"

registerHealthCheck({
  id: "browser-key",
  label: "Browser API Key",
  apiName: "API Key",
  docsLink: GOOGLE_DOCS.keys,
  async run(ctx) {
    if (!ctx.apiKey || ctx.apiKey.trim().length < 10) {
      return {
        id: "browser-key",
        label: "Browser API Key",
        status: "error",
        summary: "Missing",
        detail:
          "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured in this build. Without a key the storefront falls back to manual address entry (no Places / Geocoding / map features).",
        googleErrorCode: "MISSING_KEY",
        googleErrorMessage: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.",
        apiName: "API Key",
        suggestedFix:
          "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to a valid Maps Platform key in the build environment and redeploy.",
        docsLink: GOOGLE_DOCS.keys,
        data: { keyPresent: false },
      }
    }

    const probe = await probeMapsJs(ctx.apiKey, ctx.requestOrigin ?? ctx.allowedOrigins[0], ctx.signal)
    const classified = classifyGoogleError(probe.errorMessage)
    const invalid = probe.errorMessage && /invalid|forbidden/i.test(probe.errorMessage) && !/billing/i.test(probe.errorMessage)

    if (probe.ok || !invalid) {
      return {
        id: "browser-key",
        label: "Browser API Key",
        status: "healthy",
        summary: "Valid",
        detail: `Key is present (${ctx.apiKey.slice(0, 8)}…${ctx.apiKey.slice(-4)}) and was accepted by the Maps JavaScript bootstrap.`,
        apiName: "API Key",
        docsLink: GOOGLE_DOCS.keys,
        data: { keyPresent: true, masked: `${ctx.apiKey.slice(0, 8)}…${ctx.apiKey.slice(-4)}` },
      }
    }

    return {
      id: "browser-key",
      label: "Browser API Key",
      status: "error",
      summary: "Invalid",
      detail: probe.errorMessage ?? "The API key was rejected.",
      googleErrorCode: probe.status ?? "INVALID_KEY",
      googleErrorMessage: probe.errorMessage ?? "The API key is invalid.",
      apiName: classified?.apiName ?? "API Key",
      suggestedFix: classified?.suggestedFix,
      docsLink: classified?.docsLink ?? GOOGLE_DOCS.invalidKey,
      data: { keyPresent: true, masked: `${ctx.apiKey.slice(0, 8)}…${ctx.apiKey.slice(-4)}` },
    }
  },
})
