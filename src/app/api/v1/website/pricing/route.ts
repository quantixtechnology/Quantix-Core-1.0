import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "pricing" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ plans: [] })
    }

    const plans = await db.websitePricingPlan.findMany({
      where: { isActive: true },
      include: { features: { orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" },
    })
    return NextResponse.json({ plans })
  } catch (error) {
    console.error("[Website API] Pricing error:", error)
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 })
  }
}

export const revalidate = 3600
