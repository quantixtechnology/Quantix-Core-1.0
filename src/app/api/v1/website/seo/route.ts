import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "seo" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ seo: null })
    }

    const seo = await db.websiteSEO.findUnique({
      where: { id: "singleton" },
    })
    return NextResponse.json({ seo })
  } catch (error) {
    console.error("[Website API] SEO error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
