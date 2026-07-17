// Tenant setting — Processing Package QR mode (Pickup-First).
// GET  → current mode. PUT → set GENERATE_NEW | REUSE_BAG. Additive; a single
// field on LaundryBusiness. Read by the processing-package generator.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const row = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { processingPackageQrMode: true } })
    return NextResponse.json({ success: true, data: { processingPackageQrMode: row?.processingPackageQrMode || "GENERATE_NEW" } })
  } catch (e) {
    console.error("[pickup-settings] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const businessId = b.businessId as string | undefined
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const mode = b.processingPackageQrMode === "REUSE_BAG" ? "REUSE_BAG" : "GENERATE_NEW"
    await prisma.laundryBusiness.update({ where: { id: biz.id }, data: { processingPackageQrMode: mode } })
    return NextResponse.json({ success: true, data: { processingPackageQrMode: mode } })
  } catch (e) {
    console.error("[pickup-settings] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
