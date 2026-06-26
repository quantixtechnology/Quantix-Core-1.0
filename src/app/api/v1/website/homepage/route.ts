import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "homepage" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ homepage: null })
    }

    const homepage = await db.websiteHomepage.findUnique({
      where: { id: "singleton" },
    })
    return NextResponse.json({ homepage })
  } catch (error) {
    console.error("[Website API] Homepage error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
