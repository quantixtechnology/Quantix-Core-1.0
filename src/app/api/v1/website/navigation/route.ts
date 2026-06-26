import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "navigation" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ navigation: [] })
    }

    const navigation = await db.websiteNavigation.findMany({
      where: { isVisible: true },
      orderBy: { displayOrder: "asc" },
    })
    return NextResponse.json({ navigation })
  } catch (error) {
    console.error("[Website API] Navigation error:", error)
    return NextResponse.json({ error: "Failed to fetch navigation" }, { status: 500 })
  }
}

export const revalidate = 3600
