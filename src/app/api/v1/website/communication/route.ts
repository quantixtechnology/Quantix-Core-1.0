import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "communication" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ communication: null })
    }

    const comm = await db.websiteCommunication.findUnique({
      where: { id: "singleton" },
    })

    const comm_data = comm ? {
      ...comm,
      socialLinks: JSON.parse(comm.socialLinks || "{}"),
    } : null

    return NextResponse.json({ communication: comm_data })
  } catch (error) {
    console.error("[Website API] Communication error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
