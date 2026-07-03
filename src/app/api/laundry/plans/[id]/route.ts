// PUT   /api/laundry/plans/[id]  — update a laundry subscription plan
// DELETE /api/laundry/plans/[id]  — deactivate (soft) a plan
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const biz = await resolveLaundryBusiness(body.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || body.businessId
    const existing = await prisma.subscriptionPlan.findFirst({ where: { id, businessId: platformId } })
    if (!existing) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })

    const d: Record<string, unknown> = {}
    if (body.name != null) d.name = String(body.name).trim()
    if (body.description !== undefined) d.description = body.description || null
    if (body.price != null) d.price = Number(body.price) || 0
    if (body.billingCycle != null) d.billingCycle = body.billingCycle
    if (body.totalCredits != null) d.totalCredits = Math.max(0, Math.floor(Number(body.totalCredits) || 0))
    if (body.maxOrdersPerCycle !== undefined) d.maxOrdersPerCycle = body.maxOrdersPerCycle == null || body.maxOrdersPerCycle === "" ? null : Math.max(1, Math.floor(Number(body.maxOrdersPerCycle)))
    if (body.features !== undefined) d.features = JSON.stringify(Array.isArray(body.features) ? body.features : [])
    if (body.image !== undefined) d.image = body.image || null
    if (body.isActive !== undefined) d.isActive = !!body.isActive

    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: d })
    let features: string[] = []; try { features = JSON.parse(plan.features || "[]") } catch {}
    return NextResponse.json({ success: true, data: { ...plan, features } })
  } catch (e) {
    console.error("[laundry-plans] PUT", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Update failed" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId || ""
    const existing = await prisma.subscriptionPlan.findFirst({ where: { id, businessId: platformId } })
    if (!existing) return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 })
    await prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-plans] DELETE", e)
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 })
  }
}
