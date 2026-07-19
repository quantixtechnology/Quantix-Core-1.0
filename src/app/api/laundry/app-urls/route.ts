// GET /api/laundry/app-urls?businessId= — tenant-specific public app URLs for the
// Mobile Apps hub + credential sharing. Customer site = <slug>.<base>; Executive
// PWA = delivery.<slug>.<base> (dedicated per-tenant host — never a shared URL).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { customerUrlForSlug, executiveUrlForSlug } from "@/lib/laundry-executive-tenant"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId!)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: true, data: null })

    const business = await prisma.business.findUnique({ where: { id: biz.platformBusinessId }, select: { slug: true, domain: { select: { domain: true, status: true } } } })
    const slug = business?.slug || null
    // Prefer a live custom domain when mapped; else the tenant subdomain.
    const customDomain = business?.domain?.status === "ACTIVE" ? business.domain.domain : null
    const customerUrl = customDomain ? `https://${customDomain}` : (slug ? customerUrlForSlug(slug) : null)
    const executiveUrl = customDomain ? `https://delivery.${customDomain}` : (slug ? executiveUrlForSlug(slug) : null)

    return NextResponse.json({ success: true, data: { slug, customerUrl, executiveUrl } })
  } catch (e) {
    console.error("[laundry-app-urls] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
