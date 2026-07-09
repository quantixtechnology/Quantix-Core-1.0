// GET /api/core/commerce/templates/[id]/usage — where a template is used
// (category defaults, business/store assignments, tenant instances). Required
// before archive/deactivate so the UI never implies an assigned template is idle.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { templateUsage } from "@/lib/commerce/template-service"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

export const GET = withMiddleware(PLATFORM)(async (_request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const usage = await templateUsage(id)
  return NextResponse.json({ success: true, data: usage })
})
