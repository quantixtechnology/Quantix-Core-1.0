// GET  /api/laundry/setup?businessId=  — setup status + master counts (drives
//        the Guided Setup wizard and the dashboard "complete setup" gate)
// POST /api/laundry/setup               — mark guided setup complete
//        body: { businessId, completed?: boolean }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, completed: false, counts: { stores: 0, categories: 0, services: 0, garments: 0, pricingRules: 0 } })

    const business = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { setupCompletedAt: true } })
    const [stores, categories, services, garments, pricingRules] = await Promise.all([
      prisma.laundryStore.count({ where: { laundryBusinessId: biz.id } }),
      prisma.laundryCategory.count({ where: { businessId: biz.id } }),
      prisma.laundryService.count({ where: { businessId: biz.id } }),
      prisma.laundryGarment.count({ where: { businessId: biz.id } }),
      prisma.laundryPricingRule.count({ where: { businessId: biz.id } }),
    ])

    return NextResponse.json({
      success: true,
      completed: !!business?.setupCompletedAt,
      completedAt: business?.setupCompletedAt ?? null,
      counts: { stores, categories, services, garments, pricingRules },
    })
  } catch (e) {
    console.error("[laundry-setup] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { businessId, completed } = await request.json()
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    await prisma.laundryBusiness.update({
      where: { id: biz.id },
      data: { setupCompletedAt: completed === false ? null : new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-setup] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
