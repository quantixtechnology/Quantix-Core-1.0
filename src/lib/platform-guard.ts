// Platform-admin gate for handlers that are NOT written as withMiddleware
// wrappers (plain `export async function GET(request)` routes).
//
// It contains no authorization logic of its own — it runs the EXISTING
// withPlatformAccess middleware and reports whether it let the caller through.
// One mechanism, one place, no second security model.

import type { NextRequest } from "next/server"
import { withPlatformAccess } from "@/lib/middleware"

/**
 * Returns null when the caller is platform staff, or the middleware's own
 * 401/403 response when they are not:
 *
 *   const denied = await platformOnly(request)
 *   if (denied) return denied
 */
export async function platformOnly(request: Request): Promise<Response | null> {
  let allowed = false
  const res = await withPlatformAccess(async () => {
    allowed = true
    return new Response(null, { status: 204 })
  })(request as NextRequest)
  return allowed ? null : res
}
