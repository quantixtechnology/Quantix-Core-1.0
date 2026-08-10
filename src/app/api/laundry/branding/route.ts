// GET / PUT /api/laundry/branding — the tenant's business identity.
//
// One record, read by every surface that draws the brand. Business identity is
// deliberately NOT a store property: a chain has one brand and many branches,
// and conflating them is what made invoices lead with a branch name.
//
// Storage is the platform Business row (name, logo, primaryColor), which the
// customer site, the PWAs and the wizard already read — so uploading here
// updates them all rather than creating a parallel record to keep in step.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveImageUrl } from "@/lib/image-url"

export const runtime = "nodejs"

const DEFAULT_COLOR = "#2563eb"

async function readBranding(platformBusinessId: string) {
  const biz = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { name: true, logo: true, primaryColor: true },
  })
  return {
    businessName: biz?.name ?? "",
    logo: biz?.logo ? resolveImageUrl(biz.logo) : null,
    primaryColor: biz?.primaryColor || DEFAULT_COLOR,
  }
}

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

  const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
  if (!guard.ok) return guard.res

  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: await readBranding(biz.platformBusinessId) })
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}))
  const businessId = body.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

  const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
  if (!guard.ok) return guard.res

  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

  const name = typeof body.businessName === "string" ? body.businessName.trim() : undefined
  if (name !== undefined && !name) return NextResponse.json({ error: "Business name cannot be empty" }, { status: 400 })

  await prisma.business.update({
    where: { id: biz.platformBusinessId },
    data: {
      ...(name !== undefined ? { name } : {}),
      // null clears the logo; undefined leaves it untouched.
      ...(body.logo !== undefined ? { logo: body.logo || null } : {}),
      ...(typeof body.primaryColor === "string" && body.primaryColor ? { primaryColor: body.primaryColor } : {}),
    },
  })

  return NextResponse.json({ success: true, data: await readBranding(biz.platformBusinessId) })
}
