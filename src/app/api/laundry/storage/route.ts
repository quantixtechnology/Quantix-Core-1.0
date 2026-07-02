// GET /api/laundry/storage?businessId=  — tenant storage usage + limit + breakdown
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { computeStorageUsage } from "@/lib/laundry-storage"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    // Plan drives the storage limit (subscription first, then business default).
    const [sub, business] = await Promise.all([
      prisma.laundrySubscription.findUnique({ where: { businessId: biz.id }, select: { plan: true } }),
      prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { plan: true } }),
    ])
    const plan = sub?.plan || business?.plan || null

    const usage = await computeStorageUsage(biz.platformBusinessId, plan)
    return NextResponse.json({ success: true, plan, data: usage })
  } catch (e) {
    console.error("[laundry-storage] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
