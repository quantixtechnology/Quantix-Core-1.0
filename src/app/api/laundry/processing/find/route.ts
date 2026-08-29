// GET /api/laundry/processing/find?businessId=&q=
//
// FIND A GARMENT ANYWHERE IN THE TENANT — the workstation search box.
//
// The workstation queue is stage-scoped by design, but the operator's reason for
// searching usually is not: "I added the wrong cloth, I know its GAR, where is
// it?". A stage-scoped filter answers "not found" for a garment that is simply
// in another department, which is the least useful answer possible. So this
// searches every garment in the business and reports where each one actually is.
//
// Strictly READ ONLY. It writes nothing, advances nothing and records no event —
// finding a garment must never change it. Acting on the result still goes
// through the normal, permission-checked process endpoint, and only from the
// workstation that owns the garment's current stage.
//
// Tenant isolation is absolute: results are constrained to the caller's own
// business, so a GAR from another tenant can never surface. Membership is the
// same bar /api/laundry/scan applies for the same class of data.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"
import { stageLabel, departmentFor } from "@/lib/laundry-processing"

export const runtime = "nodejs"

/** Enough to find the garment; small enough to stay instant while typing. */
const LIMIT = 25

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const q = (sp.get("q") || "").trim()
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })

    const guard = await requireLaundryMember(request, businessId)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [], query: q })

    // An empty query is not "everything" — it is nothing to look for.
    if (!q) return NextResponse.json({ success: true, data: [], query: q })

    const rows = await prisma.laundryOrderItem.findMany({
      // businessId FIRST and always — the search is global across stages, never
      // across tenants.
      where: {
        order: { businessId: biz.id },
        OR: [
          { garmentScanCode: { contains: q } },  // GAR — the operator's handle
          { itemNumber: { contains: q } },       // ITM
          { barcode: { contains: q } },
          { garmentName: { contains: q } },
          { order: { orderNumber: { contains: q } } },
        ],
      },
      select: {
        id: true, garmentScanCode: true, itemNumber: true, barcode: true,
        garmentName: true, serviceName: true, quantity: true,
        processingStage: true, processingStatus: true,
        order: { select: { id: true, orderNumber: true, status: true } },
      },
      // Exact GAR hits are what the operator usually wants, and there is only
      // ever one — ordering by code keeps the list stable between keystrokes.
      orderBy: [{ garmentScanCode: "asc" }],
      take: LIMIT,
    })

    return NextResponse.json({
      success: true,
      query: q,
      truncated: rows.length === LIMIT,
      data: rows.map((r) => ({
        id: r.id,
        garmentScanCode: r.garmentScanCode,
        itemNumber: r.itemNumber,
        barcode: r.barcode,
        garmentName: r.garmentName,
        serviceName: r.serviceName,
        quantity: r.quantity,
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        orderStatus: r.order.status,
        // WHERE IT IS — the whole point of a global search.
        processingStage: r.processingStage,
        processingStatus: r.processingStatus,
        stageLabel: stageLabel(r.processingStage),
        department: departmentFor(r.processingStage),
      })),
    })
  } catch (e) {
    console.error("[processing-find] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
