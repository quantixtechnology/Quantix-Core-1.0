// GET/PUT /api/laundry/bag-settings — the reusable-bag release policy.
//   reusableBagReleaseStage: STORE_RECEIVE (default) | AFTER_DELIVERY
// Controls WHEN a reusable bag returns to AVAILABLE; the release logic itself is
// identical for both. No engine redesign needed to switch policy per laundry.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
  if (!guard.ok) return guard.res
  const biz = await resolveLaundryBusiness(businessId!)
  if (!biz) return NextResponse.json({ success: true, data: { reusableBagReleaseStage: "STORE_RECEIVE" } })
  const b = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { reusableBagReleaseStage: true } })
  return NextResponse.json({ success: true, data: { reusableBagReleaseStage: b?.reusableBagReleaseStage || "STORE_RECEIVE" } })
}

export async function PUT(request: Request) {
  const b = await request.json().catch(() => ({}))
  const guard = await requireLaundryPermission(request, b.businessId, "laundry.settings.edit")
  if (!guard.ok) return guard.res
  const biz = await resolveLaundryBusiness(b.businessId)
  if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
  const stage = b.reusableBagReleaseStage === "AFTER_DELIVERY" ? "AFTER_DELIVERY" : "STORE_RECEIVE"
  await prisma.laundryBusiness.update({ where: { id: biz.id }, data: { reusableBagReleaseStage: stage } })
  return NextResponse.json({ success: true, data: { reusableBagReleaseStage: stage } })
}
