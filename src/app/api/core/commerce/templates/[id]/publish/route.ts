// POST /api/core/commerce/templates/[id]/publish — snapshot draft pages/sections
// into publishedConfig (previous kept for rollback), bump publishedVersion.
// Master content publication — separate from operational `status`.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { publishTemplate, PublishError } from "@/lib/commerce/template-service"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

export const POST = withMiddleware(PLATFORM)(async (_request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  try {
    const result = await publishTemplate(id)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    if (e instanceof PublishError) return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    console.error("[commerce-template-publish]", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
})
