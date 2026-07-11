// GET  /api/laundry/customers/[id]/notes  — internal notes / activity (Parts 3/6)
// POST /api/laundry/customers/[id]/notes  — add an internal note, communication
//   log entry, or manual adjustment. Internal only — never shown to customers.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"
const TYPES = new Set(["NOTE", "COMMUNICATION", "ADJUSTMENT"])

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
    const sp = new URL(request.url).searchParams
    if (!(await scope(sp.get("businessId"), id))) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const type = sp.get("type")
    const rows = await prisma.customerActivity.findMany({ where: { customerId: id, ...(type ? { type } : {}) }, orderBy: { createdAt: "desc" }, take: 200 })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    console.error("[laundry-customer-notes] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const platformId = await scope(b.businessId, id)
    if (!platformId) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const content = String(b.content || b.body || "").trim()
    if (!content) return NextResponse.json({ error: "Note content is required" }, { status: 400 })
    const type = TYPES.has(String(b.type).toUpperCase()) ? String(b.type).toUpperCase() : "NOTE"
    const row = await prisma.customerActivity.create({
      data: { businessId: platformId, customerId: id, type, title: b.title || (type === "NOTE" ? "Internal note" : type === "COMMUNICATION" ? "Communication" : "Adjustment"), body: content, meta: b.meta ? JSON.stringify(b.meta) : "{}", actorName: b.actorName || null },
    })
    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (e) {
    console.error("[laundry-customer-notes] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
