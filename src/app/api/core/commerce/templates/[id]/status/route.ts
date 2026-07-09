// POST /api/core/commerce/templates/[id]/status — activate/deactivate/archive.
// Guards: archived templates can't be reactivated blindly; a template that is a
// category default or has active assignments can't be archived without clearing.
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { templateUsage } from "@/lib/commerce/template-service"

export const runtime = "nodejs"
const PLATFORM: Parameters<typeof withMiddleware>[0] = { requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN"] }
const VALID = new Set(["ACTIVE", "INACTIVE", "ARCHIVED", "DRAFT"])

export const POST = withMiddleware(PLATFORM)(async (request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params
  const b = await request.json().catch(() => ({}))
  const status = String(b.status || "").toUpperCase()
  if (!VALID.has(status)) return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 })

  const t = await db.commerceTemplate.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!t) return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 })

  if (status === "ARCHIVED" || status === "INACTIVE") {
    const usage = await templateUsage(id)
    if (usage.counts.categoryDefaults > 0) {
      return NextResponse.json({ success: false, error: `Template is the default for ${usage.counts.categoryDefaults} category(ies). Reassign the default before ${status === "ARCHIVED" ? "archiving" : "deactivating"}.`, usage: usage.counts }, { status: 409 })
    }
    if (status === "ARCHIVED" && usage.counts.businessAssignments + usage.counts.storeAssignments > 0) {
      return NextResponse.json({ success: false, error: "Template has active assignments — reassign those businesses before archiving.", usage: usage.counts }, { status: 409 })
    }
  }

  const updated = await db.commerceTemplate.update({ where: { id }, data: { status }, select: { id: true, status: true } })
  return NextResponse.json({ success: true, data: updated })
})
