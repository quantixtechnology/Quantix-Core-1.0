// Pickup Bags for a business — list for the Pickup / Receive-at-Store screens.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const status = searchParams.get("status") // COLLECTED | RECEIVED_AT_STORE | AUDITED
    const search = searchParams.get("search")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const resolved = await resolveLaundryBusiness(businessId)
    if (!resolved) return NextResponse.json({ success: true, data: [] })

    const where: Record<string, unknown> = { businessId: resolved.id }
    if (status) where.status = status
    if (search?.trim()) where.OR = [{ code: { contains: search.trim() } }, { orderNumber: { contains: search.trim() } }, { customerName: { contains: search.trim() } }]
    const bags = await prisma.laundryPickupBag.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 })
    return NextResponse.json({ success: true, data: bags })
  } catch (e) {
    console.error("[pickup-bags-list] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
