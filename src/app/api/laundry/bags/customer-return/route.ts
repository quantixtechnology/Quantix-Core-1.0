// POST /api/laundry/bags/customer-return
//   { businessId?, bagId | code, condition, orderId?, customerId?, storeId?, authorizedBy? }
//
// A customer hands a bag back. Condition decides where it goes — only GOOD
// re-enters stock, because returning a bag is not the same as it being reusable
// (§10, Rule 8). A bag last held by a DIFFERENT customer is refused with
// AUTHORIZATION_REQUIRED until authorised staff confirm (Rule 10).
//
// Dual auth: Delivery Executive PWA (bearer session) OR desktop admin.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveExecutive } from "@/lib/laundry-executive-auth"
import { receiveReturnedBag, identifyReturnedBag, isCondition, CUSTODIAN } from "@/lib/laundry-bag-lifecycle"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    if (!isCondition(b.condition)) {
      return NextResponse.json({ success: false, error: "A bag condition is required (GOOD, MINOR_DAMAGE, DAMAGED, HEAVILY_DAMAGED, UNUSABLE)" }, { status: 400 })
    }

    let lbId: string | null = null
    let actor: { id?: string | null; name?: string | null; role?: string | null }
    let custodian: typeof CUSTODIAN[keyof typeof CUSTODIAN]
    const session = await resolveExecutive(request)
    if (session) {
      lbId = session.businessId
      actor = { id: session.executiveId, name: String(b.executiveName || "Executive"), role: "DELIVERY_EXECUTIVE" }
      // The executive is now carrying it; the store takes custody on arrival.
      custodian = CUSTODIAN.DELIVERY_EXECUTIVE
    } else {
      if (!b.businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
      const guard = await requireLaundryPermission(request, b.businessId, "laundry.bags.return_scan")
      if (!guard.ok) return guard.res
      const biz = await resolveLaundryBusiness(b.businessId)
      if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
      lbId = biz.id
      actor = { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Staff", role: "STORE" }
      custodian = CUSTODIAN.STORE
    }

    // Accept either a resolved bagId or a raw scanned/typed code.
    let bagId = b.bagId ? String(b.bagId) : null
    if (!bagId) {
      const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
      if (!code) return NextResponse.json({ success: false, error: "A bag code is required" }, { status: 400 })
      const found = await prisma.laundryBag.findFirst({
        where: { businessId: lbId, OR: [{ bagNumber: code }, { qrValue: code }] },
        select: { id: true },
      })
      if (!found) return NextResponse.json({ success: false, error: `Bag "${code}" is not registered.`, code: "UNKNOWN_BAG" }, { status: 404 })
      bagId = found.id
    }

    const r = await receiveReturnedBag({
      lbId, bagId, condition: b.condition,
      orderId: b.orderId ? String(b.orderId) : null,
      customerId: b.customerId ? String(b.customerId) : null,
      storeId: b.storeId ? String(b.storeId) : null,
      authorizedBy: b.authorizedBy ? String(b.authorizedBy) : null,
      receivedByCustodian: custodian,
      reason: b.reason ? String(b.reason) : null,
      actor,
    })
    if (!r.ok) {
      // On a cross-customer refusal, hand back the provenance so the UI can show
      // exactly whose bag this is instead of a bare error.
      if (r.code === "AUTHORIZATION_REQUIRED") {
        const info = await identifyReturnedBag({ lbId, code: bagId, customerId: b.customerId ? String(b.customerId) : null })
          .catch(() => null)
        return NextResponse.json({ success: false, error: r.error, code: r.code, data: info?.ok ? info.bag : null }, { status: r.status })
      }
      return NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status })
    }
    return NextResponse.json({ success: true, data: { bagNumber: r.bagNumber, status: r.status, condition: r.condition } })
  } catch (e) {
    console.error("[bags-customer-return] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
