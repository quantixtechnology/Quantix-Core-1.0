// POST /api/laundry/items/[id]/process
// Scan-driven garment processing. Advances a single garment through its
// SNAPSHOTTED processing route and records a timeline event for every action.
// State transitions are server-guarded (no double completion, no invalid
// starts). QC failure requires a reason and a valid rework destination from
// the garment's own route; processing history is never overwritten.
//
// Body: { action, actorName?, note?, photos?: string[], reworkStage? }
//   action ∈ START | PAUSE | RESUME | COMPLETE | QC_PASS | QC_FAIL | REJECT | NOTE
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveFlow, nextStageOf, reworkStagesOf, departmentFor } from "@/lib/laundry-processing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

// Map a processing stage code → its RBAC workstation screen key.
const STAGE_SCREEN: Record<string, string> = {
  WASH: "washing", DRY: "drying", DRYCLEAN: "dry_cleaning", IRON: "ironing",
  FOLD: "folding", QC: "quality_check", PACKED: "packing",
}

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const action = String(b.action || "").toUpperCase()
    const item = await prisma.laundryOrderItem.findUnique({
      where: { id },
      select: { id: true, orderId: true, serviceName: true, processingStage: true, processingStatus: true, processFlow: true, qcFailCount: true, order: { select: { businessId: true } } },
    })
    if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 })
    // Enforce the workstation permission for the garment's current stage.
    // QC_FAIL / REJECT are override operations; the rest are process.
    const screen = STAGE_SCREEN[item.processingStage || ""] || "washing"
    const permAction = action === "QC_FAIL" || action === "REJECT" ? "override" : "process"
    const guard = await requireLaundryPermission(request, item.order.businessId, `processing.${screen}.${permAction}`)
    if (!guard.ok) return guard.res

    const flow = resolveFlow(item)
    const cur = item.processingStage
    const curStatus = item.processingStatus
    let stage = cur, status = curStatus, dept = departmentFor(cur)
    let toStage: string | null = cur ?? null
    let qcFailIncrement = 0
    let note: string | null = b.note || null

    switch (action) {
      case "START":
        if (curStatus !== "WAITING") return NextResponse.json({ error: `Garment is ${curStatus} — only a waiting garment can be started` }, { status: 409 })
        status = "IN_PROGRESS"; break
      case "RESUME":
        if (curStatus !== "PAUSED") return NextResponse.json({ error: "Garment is not paused" }, { status: 409 })
        status = "IN_PROGRESS"; break
      case "PAUSE":
        if (curStatus !== "IN_PROGRESS") return NextResponse.json({ error: "Garment is not in progress" }, { status: 409 })
        status = "PAUSED"; break
      case "COMPLETE": case "QC_PASS": {
        if (curStatus !== "IN_PROGRESS") return NextResponse.json({ error: `Garment is ${curStatus} — start it before completing` }, { status: 409 })
        if (action === "QC_PASS" && cur !== "QC") return NextResponse.json({ error: "QC Pass is only valid at Quality Check" }, { status: 409 })
        const nxt = nextStageOf(flow, cur)
        stage = nxt || "PACKED"; status = nxt ? "WAITING" : "DONE"; dept = departmentFor(stage); toStage = stage
        // PACKED is the terminal working state — mark done immediately.
        if (stage === "PACKED") status = "DONE"
        break
      }
      case "QC_FAIL": {
        if (cur !== "QC") return NextResponse.json({ error: "QC Fail is only valid at Quality Check" }, { status: 409 })
        if (curStatus !== "IN_PROGRESS") return NextResponse.json({ error: "Start the QC check before failing it" }, { status: 409 })
        const reason = String(b.note || "").trim()
        if (!reason) return NextResponse.json({ error: "A failure reason is required for QC Fail" }, { status: 400 })
        const valid = reworkStagesOf(flow)
        const rework = String(b.reworkStage || "").toUpperCase() || valid[0]
        if (!valid.includes(rework)) {
          return NextResponse.json({ error: `Invalid rework stage "${rework}" — valid: ${valid.join(", ")}`, validStages: valid }, { status: 400 })
        }
        stage = rework; status = "WAITING"; dept = departmentFor(rework); toStage = rework
        qcFailIncrement = 1
        note = `QC FAIL (attempt ${(item.qcFailCount || 0) + 1}): ${reason} → rework at ${departmentFor(rework)}`
        break
      }
      case "REJECT":
        status = "REJECTED"; break
      case "NOTE":
        break
      default:
        return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
    }

    const [updated] = await prisma.$transaction([
      prisma.laundryOrderItem.update({
        where: { id },
        data: {
          processingStage: stage, processingStatus: status, processingDept: dept,
          ...(qcFailIncrement ? { qcFailCount: { increment: qcFailIncrement } } : {}),
        },
      }),
      prisma.laundryItemEvent.create({
        data: {
          itemId: id, orderId: item.orderId, businessId: item.order.businessId,
          stage: cur, fromStage: cur, toStage, action,
          department: dept, actorName: b.actorName || null, note,
          photos: Array.isArray(b.photos) && b.photos.length ? JSON.stringify(b.photos) : null,
        },
      }),
    ])

    // Order milestone: when the LAST garment finishes its route, record
    // "All Garments Completed" once on the order timeline (idempotent).
    let orderComplete = false
    if (stage === "PACKED" && status === "DONE") {
      const pending = await prisma.laundryOrderItem.count({
        where: { orderId: item.orderId, NOT: { processingStage: "PACKED", processingStatus: "DONE" } },
      })
      if (pending === 0) {
        orderComplete = true
        const already = await prisma.laundryOrderEvent.findFirst({ where: { orderId: item.orderId, action: "ALL_ITEMS_COMPLETE" }, select: { id: true } })
        if (!already) {
          await prisma.laundryOrderEvent.create({
            data: { orderId: item.orderId, businessId: item.order.businessId, fromStatus: "PROCESSING", toStatus: "PROCESSING", action: "ALL_ITEMS_COMPLETE", actorName: b.actorName || null, note: "Every garment passed QC and completed its route" },
          }).catch(() => null)
        }
      }
    }

    return NextResponse.json({ success: true, data: { id: updated.id, processingStage: updated.processingStage, processingStatus: updated.processingStatus, department: updated.processingDept, qcFailCount: updated.qcFailCount, orderComplete } })
  } catch (e) {
    console.error("[laundry-item-process] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
