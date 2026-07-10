// GET  /api/core/commerce/renderer-mode?businessId= — current renderer mode.
// POST /api/core/commerce/renderer-mode — set a business's Commerce renderer
//        mode (LEGACY | TEMPLATE | AUTO). Platform/Super-Admin only. This is the
//        controlled-migration switch — a business renders via templates only
//        once explicitly set here.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { getCommerceRendererMode, setCommerceRendererMode, coerceMode } from "@/lib/commerce/renderer-mode"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }

export const GET = withMiddleware(PLATFORM)(async (request) => {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })
  const mode = await getCommerceRendererMode(businessId)
  return NextResponse.json({ success: true, data: { businessId, mode } })
})

export const POST = withMiddleware(PLATFORM)(async (request) => {
  const b = await request.json().catch(() => ({}))
  const businessId = String(b.businessId || "")
  if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })

  const business = await db.business.findUnique({ where: { id: businessId }, select: { id: true, productCode: true } })
  if (!business) return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 })
  if ((business.productCode || "").toUpperCase() !== "COMMERCE") {
    return NextResponse.json({ success: false, error: "Renderer mode applies only to COMMERCE businesses" }, { status: 409 })
  }

  const actor = (request as unknown as { user?: { name?: string } }).user?.name || null
  const mode = await setCommerceRendererMode(businessId, coerceMode(b.mode), actor)
  return NextResponse.json({ success: true, data: { businessId, mode } })
})
