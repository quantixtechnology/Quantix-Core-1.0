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
import { requireLaundryPermission, requireLaundryMember } from "@/lib/laundry-rbac"
import { resolveImageUrl } from "@/lib/image-url"
import { businessIdentitySource } from "@/lib/laundry-employee-identity"

export const runtime = "nodejs"

const DEFAULT_COLOR = "#2563eb"
const DEFAULT_SECONDARY = "#0f172a"

async function readBranding(platformBusinessId: string, laundryBusinessId: string) {
  // Resolved exactly the way the employee-id prefix resolves it, so the code on
  // screen is provably the code those ids were built from — showing a different
  // one would be worse than showing none.
  const businessCode = await businessIdentitySource(platformBusinessId, laundryBusinessId)
    .then((s) => s.code)
    .catch(() => null)
  const biz = await prisma.business.findUnique({
    where: { id: platformBusinessId },
    select: { name: true, logo: true, primaryColor: true, secondaryColor: true },
  })
  return {
    businessName: biz?.name ?? "",
    businessCode: businessCode ?? null,
    logo: biz?.logo ? resolveImageUrl(biz.logo) : null,
    primaryColor: biz?.primaryColor || DEFAULT_COLOR,
    secondaryColor: biz?.secondaryColor || DEFAULT_SECONDARY,
  }
}

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

  // READ: any authenticated member of this business. The workspace shell draws
  // the logo before anyone has opened a settings screen, so requiring
  // laundry.settings.view meant a Store Manager, Supervisor or counter user got
  // a 403 here and an unbranded sidebar — while owners and Super Admin, who
  // hold that permission, saw the logo and never noticed.
  //
  // Writing still requires laundry.settings.edit; see PUT below.
  const guard = await requireLaundryMember(request, businessId)
  if (!guard.ok) return guard.res

  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: await readBranding(biz.platformBusinessId, biz.id) })
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
      // Business.secondaryColor already existed on the model; the branding page
      // is simply the first surface to let a tenant set it. A picker that
      // discarded its value would be worse than no picker.
      ...(typeof body.secondaryColor === "string" && body.secondaryColor ? { secondaryColor: body.secondaryColor } : {}),
    },
  })

  return NextResponse.json({ success: true, data: await readBranding(biz.platformBusinessId, biz.id) })
}
