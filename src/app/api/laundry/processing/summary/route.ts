import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLaundryAuthContext } from "@/lib/laundry-auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get("businessId")

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 })
  }

  const auth = await getLaundryAuthContext(businessId)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const orders = await prisma.laundryOrder.findMany({
      where: { businessId },
      select: { status: true },
    })

    const awaitingProcessing = orders.filter(o => o.status === "READY_FOR_PROCESSING").length
    const inProgress = orders.filter(o => o.status === "PROCESSING").length
    const qcPending = orders.filter(o => o.status === "QC_PENDING").length
    const completedToday = orders.filter(o => o.status === "DELIVERED").length

    return NextResponse.json({
      awaitingProcessing,
      inProgress,
      qcPending,
      completedToday,
      inTransit: 0,
    })
  } catch (error) {
    console.error("Error fetching processing summary:", error)
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 })
  }
}
