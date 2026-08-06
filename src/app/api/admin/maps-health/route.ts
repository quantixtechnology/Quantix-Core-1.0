// ============================================================================
// GET  /api/admin/maps-health — run the full Google Maps Platform Health Monitor
//
// Super Admin / Platform Settings. Runs every pluggable check plus the
// store-field and serviceability-sample sections, and returns the aggregate
// report the admin page renders. Never depends on the browser being present.
// ============================================================================

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withMiddleware, createErrorResponse } from "@/lib/middleware"
import { generateMapsHealthReport } from "@/lib/maps-health/runner"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

const STOREFRONT_DOMAIN = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"
const ADMIN_DOMAIN = process.env.NEXT_PUBLIC_APP_URL || `app.${STOREFRONT_DOMAIN}`

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: "settings:view",
})(async (req: AuthenticatedRequest) => {
  try {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
    const requestOrigin = req.headers.get("origin") || null
    const allowedOrigins = [
      `https://${STOREFRONT_DOMAIN}`,
      `https://app.${STOREFRONT_DOMAIN}`,
      ADMIN_DOMAIN,
    ].filter((o) => o.startsWith("https://"))

    const report = await generateMapsHealthReport({
      apiKey: key,
      allowedOrigins,
      requestOrigin,
    })

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed"
    return createErrorResponse(message, 500)
  }
})