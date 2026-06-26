import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "theme" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ theme: null })
    }

    const theme = await db.websiteTheme.findUnique({
      where: { id: "singleton" },
    })
    return NextResponse.json({ theme })
  } catch (error) {
    console.error("[Website API] Theme error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
