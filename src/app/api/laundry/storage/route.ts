// GET /api/laundry/storage?businessId=  — tenant storage usage + limit + breakdown
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { computeBusinessUsage } from "@/lib/laundry-storage"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    // Tenant isolation: authenticated AND a member of THIS business —
    // knowing a businessId is not authorization.
    const _guard = await requireLaundryMember(request, businessId)
    if (!_guard.ok) return _guard.res
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    // Plan name is a LABEL only — the limit is resolved from THIS business's
    // allocation (see resolveStorageLimit), never from the name.
    const [sub, business] = await Promise.all([
      prisma.laundrySubscription.findUnique({ where: { businessId: biz.id }, select: { plan: true } }),
      prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { plan: true } }),
    ])
    const plan = sub?.plan || business?.plan || null

    // biz.id / biz.platformBusinessId both come from the requested businessId,
    // which the guard above proved this caller belongs to — quota and usage are
    // scoped to the current tenant end to end.
    const { storage, stores, limit, calculatedAt } = await computeBusinessUsage(biz.id, biz.platformBusinessId)
    return NextResponse.json({ success: true, plan, data: storage, stores, limit, calculatedAt })
  } catch (e) {
    console.error("[laundry-storage] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
