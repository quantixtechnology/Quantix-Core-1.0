// Reusable Bag — detail + full history; PATCH to mark Available/Damaged/Lost or
// edit notes. The Bag ID + QR are permanent; "Replace QR Label" just reprints
// the same qrValue (no data change) — never creates a duplicate bag.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const ADMIN_STATUSES = new Set(["AVAILABLE", "DAMAGED", "LOST", "CLEANING"])

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bag = await prisma.laundryBag.findUnique({ where: { id }, include: { assignments: { orderBy: { assignedAt: "desc" }, take: 100 } } })
    if (!bag) return NextResponse.json({ error: "Bag not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, bag.businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    return NextResponse.json({ success: true, data: bag })
  } catch (e) {
    console.error("[bag] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const bag = await prisma.laundryBag.findUnique({ where: { id }, select: { businessId: true, status: true } })
    if (!bag) return NextResponse.json({ error: "Bag not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, bag.businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res

    const data: Record<string, unknown> = {}
    if (b.notes !== undefined) data.notes = b.notes || null
    if (b.status !== undefined) {
      // Admin may only set lifecycle-neutral states (Available/Damaged/Lost/
      // Cleaning). Operational states are driven by the workflow endpoints.
      if (!ADMIN_STATUSES.has(b.status)) return NextResponse.json({ error: "Invalid status for manual change." }, { status: 400 })
      data.status = b.status
      if (b.status === "AVAILABLE") Object.assign(data, { currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null, currentCustomerId: null, currentCustomerName: null })
    }
    const updated = await prisma.laundryBag.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error("[bag] PATCH", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
