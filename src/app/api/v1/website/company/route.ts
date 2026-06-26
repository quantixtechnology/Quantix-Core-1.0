import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "company" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ company: null })
    }

    const company = await db.websiteCompanyInfo.findUnique({
      where: { id: "singleton" },
    })
    return NextResponse.json({ company })
  } catch (error) {
    console.error("[Website API] Company error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
