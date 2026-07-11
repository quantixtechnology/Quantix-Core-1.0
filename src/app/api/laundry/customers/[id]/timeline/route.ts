// GET /api/laundry/customers/[id]/timeline — one unified timeline of orders,
// payments, subscriptions, notes, communication and adjustments (Part 3).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { customerTimeline } from "@/lib/laundry-customer"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const cust = await prisma.customer.findFirst({ where: { id, businessId: biz.platformBusinessId }, select: { id: true } })
    if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const timeline = await customerTimeline(id)
    return NextResponse.json({ success: true, data: timeline })
  } catch (e) {
    console.error("[laundry-customer-timeline] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
