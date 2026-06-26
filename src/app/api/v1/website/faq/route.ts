import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async (req: Request) => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "faq" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ faq: [] })
    }

    // Support filtering by category via query param
    const url = new URL(req.url)
    const category = url.searchParams.get("category")

    const faq = await db.websiteFAQ.findMany({
      where: {
        isVisible: true,
        ...(category ? { category } : {}),
      },
      orderBy: { sortOrder: "asc" },
    })
    return NextResponse.json({ faq })
  } catch (error) {
    console.error("[Website API] FAQ error:", error)
    return NextResponse.json({ error: "Failed to fetch FAQ" }, { status: 500 })
  }
}

export const revalidate = 3600
