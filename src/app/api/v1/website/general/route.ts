import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Public read-only endpoint for website general settings
// No authentication required - returns only published content
export const GET = async () => {
  try {
    // Check if section is published
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "general" },
    })

    // Return empty if not published
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ general: null })
    }

    const general = await db.websiteGeneral.findUnique({
      where: { id: "singleton" },
    })

    return NextResponse.json({ general })
  } catch (error) {
    console.error("[Website API] General endpoint error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

// Cache: Revalidate every 1 hour (3600 seconds)
export const revalidate = 3600
