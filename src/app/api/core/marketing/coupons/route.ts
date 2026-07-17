// Customer — available public coupons for a business/workspace.
// Reuses the storefront business context (no RBAC). Returns only live, public,
// code-bearing vouchers the customer can enter/apply.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isLive, type PromotionLite } from "@/lib/marketing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const workspaceType = searchParams.get("workspaceType")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const resolved = await resolveLaundryBusiness(businessId)
    const bizId = resolved?.platformBusinessId || businessId

    const rows = await prisma.promotion.findMany({
      where: { businessId: bizId, status: "ACTIVE", enabled: true, code: { not: null } },
      orderBy: { createdAt: "desc" },
    })
    const now = new Date()
    const data = rows
      .filter((p) => isLive(p as unknown as PromotionLite, now))
      .filter((p) => !p.workspaceType || !workspaceType || p.workspaceType === workspaceType)
      .map((p) => ({
        code: p.code, title: p.title, description: p.description,
        discountType: p.discountType, discountValue: p.discountValue,
        maxDiscount: p.maxDiscount, minOrderValue: p.minOrderValue,
        endAt: p.endAt,
      }))
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[marketing-coupons] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
