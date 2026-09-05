// GET  /api/laundry/orders/[id]/dv-correction — history + whether the caller may correct
// POST /api/laundry/orders/[id]/dv-correction — apply a correction
//
// The Payments & Ledger Deal Value override. Restricted to Quantix Super Admin,
// the business Owner and the Accountant, and that restriction is enforced HERE:
// hiding the button is a convenience, this is the control. A permitted caller
// still has to pass the normal business scoping first.
//
// Nothing in the pricing engine, the subscription engine or the processing
// workflow is touched — see lib/laundry-dv-correction.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { canCorrectDealValue, roleLabelFor, correctDealValue, dvCorrectionHistory } from "@/lib/laundry-dv-correction"

export const runtime = "nodejs"

// Business scoping first (which tenant, and may they see this screen at all),
// then the role gate. Order matters: a caller from another business must never
// learn anything about this order, whatever their role is in their own.
async function authorise(request: Request, id: string) {
  const ord = await prisma.laundryOrder.findUnique({ where: { id }, select: { businessId: true } })
  if (!ord) return { fail: NextResponse.json({ error: "Order not found" }, { status: 404 }) }
  const guard = await requireLaundryPermission(request, ord.businessId, "store_ops.payment_collection.view")
  if (!guard.ok) return { fail: guard.res }
  const who = {
    platformRole: guard.ctx.role,
    isOwner: !!guard.resolved.isOwner,
    roleCode: guard.resolved.roleCode,
  }
  return { who, allowed: canCorrectDealValue(who), actorId: guard.ctx.userId, actorName: guard.ctx.userName }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const a = await authorise(request, id)
    if (a.fail) return a.fail
    // History is visible to anyone who may view Payments; only the ACTION is
    // restricted, and `canCorrect` is what the panel uses to show the button.
    return NextResponse.json({ success: true, data: { canCorrect: a.allowed, history: await dvCorrectionHistory(id) } })
  } catch (e) {
    console.error("[dv-correction] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const a = await authorise(request, id)
    if (a.fail) return a.fail
    if (!a.allowed) {
      return NextResponse.json(
        { error: "Only the Quantix Super Admin, the Owner or an Accountant can correct a Deal Value.", code: "FORBIDDEN" },
        { status: 403 },
      )
    }
    const b = await request.json().catch(() => ({}))
    const res = await correctDealValue(id, {
      newDv: b.newDv, comment: b.comment,
      actorId: a.actorId, actorName: a.actorName,
      role: roleLabelFor(a.who!),
    })
    // A rejected correction (bad amount, missing comment) is a 400: the caller
    // may act, they just have not given something usable.
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ success: true, data: { ...res, history: await dvCorrectionHistory(id) } })
  } catch (e) {
    console.error("[dv-correction] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
