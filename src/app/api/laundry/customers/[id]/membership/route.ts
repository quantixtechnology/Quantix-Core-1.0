// GET /api/laundry/customers/[id]/membership?businessId=
// The customer's full membership picture (Membership Hub): membership ID, plan,
// status, validity dates, remaining garments/orders/KG and outstanding due.
// Powers the admin Customer Membership tab and the Store POS walk-in lookup.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { customerMembership } from "@/lib/laundry-subscription-purchase"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.customers.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 })
    const cust = await prisma.customer.findFirst({ where: { id, businessId: biz.platformBusinessId }, select: { id: true } })
    if (!cust) return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 })
    const data = await customerMembership(biz.platformBusinessId, id)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-customer-membership] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
