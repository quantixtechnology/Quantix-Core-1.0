// GET  /api/laundry/settings/customer-sources?businessId=  — the list
// POST /api/laundry/settings/customer-sources              — add one
// PATCH … { order: [id, id, …] }                           — reorder
//
// The acquisition sources a business offers when creating a customer. Seeded
// with Direct / Sales / Event on first read, so a business that predates this
// feature gets its list without a migration.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"
import { listCustomerSources } from "@/lib/laundry-customer-source"

export const runtime = "nodejs"

async function scope(request: Request, businessId: string | null) {
  const guard = await requireLaundryMember(request, businessId)
  if (!guard.ok) return { res: guard.res as Response }
  if (!businessId) return { res: NextResponse.json({ error: "Missing businessId" }, { status: 400 }) }
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return { res: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  return { lbId: biz.id }
}

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const s = await scope(request, businessId)
    if ("res" in s) return s.res
    return NextResponse.json({ success: true, data: await listCustomerSources(s.lbId) })
  } catch (e) {
    console.error("[customer-sources] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const s = await scope(request, body.businessId ?? null)
    if ("res" in s) return s.res

    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const existing = await listCustomerSources(s.lbId)
    if (existing.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 })
    }
    const created = await prisma.laundryCustomerSource.create({
      data: {
        businessId: s.lbId, name,
        color: String(body.color || "#64748B"),
        // New rows land at the end, where a person expects them.
        displayOrder: existing.length,
      },
      select: { id: true, name: true, color: true, displayOrder: true, active: true },
    })
    return NextResponse.json({ success: true, data: created })
  } catch (e) {
    console.error("[customer-sources] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const s = await scope(request, body.businessId ?? null)
    if ("res" in s) return s.res

    const order: string[] = Array.isArray(body.order) ? body.order.map(String) : []
    if (!order.length) return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 })

    // Scoped to THIS business, so an id from elsewhere cannot be reordered in.
    const mine = new Set((await prisma.laundryCustomerSource.findMany({
      where: { businessId: s.lbId }, select: { id: true },
    })).map((r) => r.id))

    await prisma.$transaction(
      order.filter((id) => mine.has(id)).map((id, i) =>
        prisma.laundryCustomerSource.update({ where: { id }, data: { displayOrder: i } })),
    )
    return NextResponse.json({ success: true, data: await listCustomerSources(s.lbId) })
  } catch (e) {
    console.error("[customer-sources] PATCH", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
