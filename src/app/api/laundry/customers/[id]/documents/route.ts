// GET    /api/laundry/customers/[id]/documents          — list (Part 7)
// POST   /api/laundry/customers/[id]/documents          — attach (ID/GST/business)
// DELETE /api/laundry/customers/[id]/documents?docId=   — remove
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"
const DOC_TYPES = new Set(["ID_PROOF", "GST", "BUSINESS", "OTHER"])

async function scope(businessId: string | null, customerId: string) {
  if (!businessId) return null
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return null
  const cust = await prisma.customer.findFirst({ where: { id: customerId, businessId: biz.platformBusinessId }, select: { id: true } })
  return cust ? biz.platformBusinessId : null
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireLaundryPermission(request, new URL(request.url).searchParams.get("businessId"), "laundry.customers.view")
    if (!guard.ok) return guard.res
    if (!(await scope(new URL(request.url).searchParams.get("businessId"), id))) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const docs = await prisma.customerDocument.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } })
    return NextResponse.json({ success: true, data: docs })
  } catch (e) {
    console.error("[laundry-customer-documents] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.customers.edit")
    if (!guard.ok) return guard.res
    const platformId = await scope(b.businessId, id)
    if (!platformId) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    if (!b.url || !b.name?.trim()) return NextResponse.json({ error: "Document name and url are required" }, { status: 400 })
    const docType = DOC_TYPES.has(String(b.docType).toUpperCase()) ? String(b.docType).toUpperCase() : "OTHER"
    const doc = await prisma.customerDocument.create({ data: { businessId: platformId, customerId: id, docType, name: b.name.trim(), url: b.url, note: b.note || null, uploadedBy: b.actorName || null } })
    return NextResponse.json({ success: true, data: doc }, { status: 201 })
  } catch (e) {
    console.error("[laundry-customer-documents] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "laundry.customers.edit")
    if (!guard.ok) return guard.res
    if (!(await scope(sp.get("businessId"), id))) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const docId = sp.get("docId")
    if (!docId) return NextResponse.json({ error: "docId is required" }, { status: 400 })
    await prisma.customerDocument.deleteMany({ where: { id: docId, customerId: id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-customer-documents] DELETE", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
