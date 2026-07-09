// POST /api/core/commerce/templates/[id]/duplicate — deep clone (pages/sections/
// config/categories/draft). Does NOT clone assignments/defaults/tenant instances.
// New template starts DRAFT with a unique code.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { duplicateTemplate, PublishError } from "@/lib/commerce/template-service"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

export const POST = withMiddleware(PLATFORM)(async (request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const actor = (request as unknown as { user?: { name?: string } }).user?.name || null
  try {
    const created = await duplicateTemplate(id, actor)
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (e) {
    if (e instanceof PublishError) return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    console.error("[commerce-template-duplicate]", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
})
