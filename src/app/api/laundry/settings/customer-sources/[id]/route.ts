// PATCH  /api/laundry/settings/customer-sources/[id]  — rename, recolour, activate
// DELETE /api/laundry/settings/customer-sources/[id]  — only while unused
//
// A source that customers already carry cannot be deleted. Removing it would
// leave those records pointing at nothing, and the honest history of how a
// customer was won is not the kind of thing to lose to a tidy-up. Retiring one
// is `active: false`: it disappears from new dropdowns and stays readable on
// every record that already has it.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"
import { customerSourceUsage } from "@/lib/laundry-customer-source"

export const runtime = "nodejs"

async function scoped(request: Request, businessId: string | null, id: string) {
  const guard = await requireLaundryMember(request, businessId)
  if (!guard.ok) return { res: guard.res as Response }
  if (!businessId) return { res: NextResponse.json({ error: "Missing businessId" }, { status: 400 }) }
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return { res: NextResponse.json({ error: "Laundry business not found" }, { status: 404 }) }
  // The row must belong to THIS business — an id alone is not authorization.
  const row = await prisma.laundryCustomerSource.findFirst({
    where: { id, businessId: biz.id }, select: { id: true, name: true },
  })
  if (!row) return { res: NextResponse.json({ error: "Source not found" }, { status: 404 }) }
  return { lbId: biz.id, row }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const s = await scoped(request, body.businessId ?? null, id)
    if ("res" in s) return s.res

    const data: { name?: string; color?: string; active?: boolean } = {}
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
    if (typeof body.color === "string" && body.color.trim()) data.color = body.color.trim()
    if (typeof body.active === "boolean") data.active = body.active
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 })

    if (data.name) {
      const clash = await prisma.laundryCustomerSource.findFirst({
        where: { businessId: s.lbId, name: data.name, NOT: { id } }, select: { id: true },
      })
      if (clash) return NextResponse.json({ error: `"${data.name}" already exists` }, { status: 409 })
    }

    const updated = await prisma.laundryCustomerSource.update({
      where: { id }, data,
      select: { id: true, name: true, color: true, displayOrder: true, active: true },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error("[customer-sources] PATCH", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const s = await scoped(request, businessId, id)
    if ("res" in s) return s.res

    const inUse = await customerSourceUsage(id)
    if (inUse > 0) {
      return NextResponse.json({
        error: `${s.row.name} is used by ${inUse} customer${inUse === 1 ? "" : "s"}. Deactivate it instead — it will stop appearing for new customers and stay on their records.`,
      }, { status: 409 })
    }
    await prisma.laundryCustomerSource.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[customer-sources] DELETE", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
