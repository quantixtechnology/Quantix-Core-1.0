// Laundry Invoice — ADMIN endpoints (single shared engine).
//   GET  /api/laundry/orders/[id]/invoice?businessId=  → full invoice payload
//        (lazily generates the invoice once billing is final at Store Audit).
//   POST /api/laundry/orders/[id]/invoice { businessId } → explicitly generate.
//
// Both delegate to the ONE invoice service (src/lib/laundry-invoice.ts). The
// Customer endpoints reuse the same service — never a second implementation.
// Reuses existing order permissions (no RBAC change).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveInvoiceView, generateLaundryInvoice } from "@/lib/laundry-invoice"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const owned = await prisma.laundryOrder.findFirst({ where: { id, businessId: biz.id }, select: { id: true } })
    if (!owned) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    const view = await resolveInvoiceView(id)
    if (!view.ok) return NextResponse.json({ success: false, error: view.error }, { status: view.status ?? 400 })
    return NextResponse.json({ success: true, data: view.data })
  } catch (e) {
    console.error("[laundry-invoice] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    if (!b.businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.orders.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const owned = await prisma.laundryOrder.findFirst({ where: { id, businessId: biz.id }, select: { id: true } })
    if (!owned) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    const gen = await generateLaundryInvoice(id)
    if (!gen.ok) return NextResponse.json({ success: false, error: gen.error }, { status: gen.status ?? 400 })
    return NextResponse.json({ success: true, data: { invoiceNumber: gen.invoiceNumber } })
  } catch (e) {
    console.error("[laundry-invoice] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
