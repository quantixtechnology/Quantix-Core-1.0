import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "features" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ features: [] })
    }

    const features = await db.websiteFeature.findMany({
      where: { isVisible: true },
      orderBy: { displayOrder: "asc" },
    })
    return NextResponse.json({ features })
  } catch (error) {
    console.error("[Website API] Features error:", error)
    return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 })
  }
}

export const revalidate = 3600
