// POST /api/laundry/bags/:id/inspect { condition, notes? }
//
// Closes out an INSPECTION_REQUIRED bag with a condition decision. This is a
// thin route over the Slice 1 lifecycle service — the condition→status rule is
// NOT reimplemented here, so an inspection and a customer return can never
// disagree about what "minor damage" means.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { inspectBag, isCondition } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    if (!isCondition(b.condition)) {
      return NextResponse.json({ success: false, error: "A bag condition is required (GOOD, MINOR_DAMAGE, DAMAGED, HEAVILY_DAMAGED, UNUSABLE)" }, { status: 400 })
    }
    const bag = await prisma.laundryBag.findUnique({ where: { id }, select: { businessId: true } })
    if (!bag) return NextResponse.json({ success: false, error: "Bag not found" }, { status: 404 })
    // Inspection puts a bag back into circulation, so it is gated like a release
    // rather than like a read.
    const guard = await requireLaundryPermission(request, bag.businessId, "laundry.bags.manual_release")
    if (!guard.ok) return guard.res

    const r = await inspectBag({
      lbId: bag.businessId, bagId: id, condition: b.condition,
      notes: b.notes ? String(b.notes) : null,
      actor: { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff", role: "ADMIN" },
    })
    if (!r.ok) return NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status })
    return NextResponse.json({ success: true, data: { bagNumber: r.bagNumber, status: r.status } })
  } catch (e) {
    console.error("[bag-inspect] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
