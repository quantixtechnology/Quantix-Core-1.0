// POST /api/laundry/items/[id]/process
// Scan-driven garment processing. Advances a single garment through its stage
// flow and records a timeline event for every action. Never touches pricing.
//
// Body: { action, actorName?, note?, photos?: string[] }
//   action ∈ RECEIVE | START | COMPLETE | QC_PASS | QC_FAIL | REJECT | NOTE
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { firstStage, nextStage, departmentFor } from "@/lib/laundry-processing"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const action = String(b.action || "").toUpperCase()
    const item = await prisma.laundryOrderItem.findUnique({ where: { id }, select: { id: true, orderId: true, serviceName: true, processingStage: true, processingStatus: true, order: { select: { businessId: true } } } })
    if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 })

    const cur = item.processingStage
    let stage = cur, status = item.processingStatus, dept = departmentFor(cur)
    let toStage: string | null = cur ?? null

    switch (action) {
      case "RECEIVE": stage = firstStage(item.serviceName); status = "WAITING"; dept = departmentFor(stage); toStage = stage; break
      case "START": status = "IN_PROGRESS"; break
      case "COMPLETE": case "QC_PASS": {
        const nxt = nextStage(item.serviceName, cur)
        stage = nxt || "PACKED"; status = nxt ? "WAITING" : "DONE"; dept = departmentFor(stage); toStage = stage; break
      }
      case "QC_FAIL": { stage = firstStage(item.serviceName); status = "WAITING"; dept = departmentFor(stage); toStage = stage; break } // rework
      case "REJECT": status = "REJECTED"; break
      case "NOTE": break
      default: return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
    }

    const [updated] = await prisma.$transaction([
      prisma.laundryOrderItem.update({
        where: { id },
        data: {
          processingStage: stage, processingStatus: status, processingDept: dept,
          ...(action === "RECEIVE" ? { receivedAt: new Date() } : {}),
        },
      }),
      prisma.laundryItemEvent.create({
        data: {
          itemId: id, orderId: item.orderId, businessId: item.order.businessId,
          stage: cur, fromStage: cur, toStage, action,
          department: dept, actorName: b.actorName || null, note: b.note || null,
          photos: Array.isArray(b.photos) && b.photos.length ? JSON.stringify(b.photos) : null,
        },
      }),
    ])

    return NextResponse.json({ success: true, data: { id: updated.id, processingStage: updated.processingStage, processingStatus: updated.processingStatus, department: updated.processingDept } })
  } catch (e) {
    console.error("[laundry-item-process] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
