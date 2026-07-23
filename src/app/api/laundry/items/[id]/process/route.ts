// POST /api/laundry/items/[id]/process
// Scan-driven garment processing. Advances a single garment through its
// SNAPSHOTTED processing route and records a timeline event for every action.
// State transitions are server-guarded with optimistic locking (no double
// completion, no duplicate starts). QC failure requires a reason and a valid
// rework destination from the garment's own route; processing history is never
// overwritten. RETURN (return-to-queue) requires return_queue permission and
// records a full audit with operator, department, timestamps, and reason.
//
// Body: { action, actorName?, note?, photos?: string[], reworkStage? }
//   action ∈ START | PAUSE | RESUME | COMPLETE | QC_PASS | QC_FAIL | REJECT | RETURN | NOTE
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveFlow, nextStageOf, reworkStagesOf, departmentFor, stageLabel } from "@/lib/laundry-processing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

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
      select: { id: true, orderId: true, serviceName: true, processingStage: true, processingStatus: true, processFlow: true, qcFailCount: true, order: { select: { businessId: true, status: true } } },
    })
    if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 })

    const screen = STAGE_SCREEN[item.processingStage || ""] || "washing"
    let permAction: string
    if (action === "QC_FAIL" || action === "REJECT") permAction = "override"
    else if (action === "RETURN") permAction = "return_queue"
    else permAction = "process"
    const guard = await requireLaundryPermission(request, item.order.businessId, `processing.${screen}.${permAction}`)
    if (!guard.ok) return guard.res

    // ── Scan safety (server-authoritative). A garment may only be processed on a
    // LIVE order and at the workstation it currently belongs to. Every rejection
    // here happens BEFORE any write — no status change, no timeline event, no
    // timestamp — so a wrong/duplicate/stale scan is completely inert. ──
    if (item.order.status === "CANCELLED")
      return NextResponse.json({ error: "This order has been cancelled — the garment cannot be processed." }, { status: 409 })
    if (item.order.status === "DELIVERED")
      return NextResponse.json({ error: "This order has already been delivered — the garment cannot be processed." }, { status: 409 })
    // Correct-workstation guard: the caller (workstation) declares which station
    // it is; reject a garment that belongs to a different department.
    const expectedStage = typeof b.expectedStage === "string" && b.expectedStage ? b.expectedStage : null
    if (expectedStage && item.processingStage !== expectedStage)
      return NextResponse.json({ error: `This garment is not ready for ${stageLabel(expectedStage)} — it belongs to ${stageLabel(item.processingStage)}.` }, { status: 409 })

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
      case "RETURN":
        if (curStatus !== "IN_PROGRESS") return NextResponse.json({ error: `Garment is ${curStatus} — only in-progress items can be returned to queue` }, { status: 409 })
        status = "WAITING"; note = b.note || "Returned to queue"; break
      case "REJECT":
        status = "REJECTED"; break
      case "NOTE":
        break
      default:
        return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
    }

    // Optimistic locking: atomically update only if current status matches expected.
    // Uses updateMany with a status where-clause — returns 0 rows if another
    // operator moved this garment between read and write.
    const [updated] = await prisma.$transaction([
      prisma.laundryOrderItem.updateManyAndReturn({
        where: { id, processingStatus: curStatus },
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
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Conflict — garment was already moved by another operator" }, { status: 409 })
    }

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

    const row = updated[0]
    return NextResponse.json({ success: true, data: { id: row.id, processingStage: row.processingStage, processingStatus: row.processingStatus, department: row.processingDept, qcFailCount: row.qcFailCount, orderComplete } })
  } catch (e) {
    console.error("[laundry-item-process] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
