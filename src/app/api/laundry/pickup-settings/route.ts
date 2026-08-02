// Tenant setting — Processing Package QR mode (Pickup-First).
// GET  → current mode. PUT → set GENERATE_NEW | REUSE_BAG | BOTH. Additive; a
// single field on LaundryBusiness. Read by the processing-package generator and
// the finishing workstations:
//   GENERATE_NEW → the package carries a fresh PKG QR (scan the package).
//   REUSE_BAG    → the package reuses the Pickup Bag QR (scan the bag).
//   BOTH         → either scan target resolves the same processing batch.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const VALID_MODES = new Set(["GENERATE_NEW", "REUSE_BAG", "BOTH"])

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
    const requested = String(b.processingPackageQrMode || "").toUpperCase()
    const mode = VALID_MODES.has(requested) ? requested : "GENERATE_NEW"
    await prisma.laundryBusiness.update({ where: { id: biz.id }, data: { processingPackageQrMode: mode } })
    return NextResponse.json({ success: true, data: { processingPackageQrMode: mode } })
  } catch (e) {
    console.error("[pickup-settings] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
