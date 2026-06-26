import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "footer" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ footer: null })
    }

    const footer = await db.websiteFooter.findUnique({
      where: { id: "singleton" },
    })

    const footer_data = footer ? {
      ...footer,
      quickLinks: JSON.parse(footer.quickLinks || "[]"),
      socialLinks: JSON.parse(footer.socialLinks || "{}"),
    } : null

    return NextResponse.json({ footer: footer_data })
  } catch (error) {
    console.error("[Website API] Footer error:", error)
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 })
  }
}

export const revalidate = 3600
