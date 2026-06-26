import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async (req: Request) => {
  try {
    // Media doesn't have publish state, always accessible
    const url = new URL(req.url)
    const category = url.searchParams.get("category")

    const media = await db.websiteMedia.findMany({
      where: category ? { category } : {},
      orderBy: { uploadedAt: "desc" },
    })
    return NextResponse.json({ media })
  } catch (error) {
    console.error("[Website API] Media error:", error)
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 })
  }
}

export const revalidate = 3600
