// GET /api/laundry/processing/summary?businessId=
// Production-floor summary for the Processing dashboard. Every number is a LIVE
// aggregate — garment-level counts come from processingStage (reconciling with
// the per-workstation queues), order-level counts from status. No hardcoded or
// mislabeled values.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLaundryAuthContext } from "@/lib/laundry-auth"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

// Configurable working stages a garment can sit in on the floor (Dry & Quality
// Check counted separately; RECEIVED = awaiting entry; Transit terminal / legacy
// Packed = finished).
const WORKING_STAGES = ["WASH", "DRYCLEAN", "SORTING", "IRON", "FOLD"]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })

  const auth = await getLaundryAuthContext(businessId, req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const guard = await requireLaundryPermission(req, businessId, "processing.console_receive.view")
  if (!guard.ok) return guard.res

  try {
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ awaitingProcessing: 0, inProgress: 0, qcPending: 0, completedToday: 0, inTransit: 0 })

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    // Garment-level distribution across processing stages (same source as the
    // workstation queues → the numbers reconcile).
    const grouped = await prisma.laundryOrderItem.groupBy({
      by: ["processingStage"],
      where: { order: { businessId: biz.id }, processingStage: { not: null } },
      _count: { _all: true },
    })
    const stageCount = (s: string) => grouped.find((g) => g.processingStage === s)?._count._all ?? 0

    const [inTransit, completedToday] = await Promise.all([
      // Order-level: packages physically moving to the Processing Center.
      prisma.laundryOrder.count({ where: { businessId: biz.id, status: "IN_TRANSIT_TO_PROCESSING" } }),
      // Orders actually delivered today (deliveredAt within today).
      prisma.laundryOrder.count({ where: { businessId: biz.id, status: "DELIVERED", deliveredAt: { gte: startOfToday } } }),
    ])

    return NextResponse.json({
      awaitingProcessing: stageCount("RECEIVED"),                                   // audited, awaiting Move to Processing
      inProgress: WORKING_STAGES.reduce((n, s) => n + stageCount(s), 0),            // garments on the floor
      qcPending: stageCount("QC"),                                                  // garments at Quality Check
      completedToday,                                                               // orders delivered today
      inTransit,                                                                    // packages in transit to PC
    })
  } catch (error) {
    console.error("Error fetching processing summary:", error)
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 })
  }
}
