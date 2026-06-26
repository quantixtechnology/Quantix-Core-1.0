import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "announcement" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ announcement: null })
    }

    const announcement = await db.websiteAnnouncement.findUnique({
      where: { id: "singleton" },
    })

    // Only return if enabled and not expired
    if (announcement && !announcement.isEnabled) {
      return NextResponse.json({ announcement: null })
    }

    if (announcement && announcement.expiryDate && announcement.expiryDate < new Date()) {
      return NextResponse.json({ announcement: null })
    }

    return NextResponse.json({ announcement })
  } catch (error) {
    console.error("[Website API] Announcement error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
