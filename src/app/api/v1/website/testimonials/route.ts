import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const GET = async () => {
  try {
    const publishState = await db.websitePublishState.findUnique({
      where: { sectionKey: "testimonials" },
    })
    if (!publishState || publishState.status !== "PUBLISHED") {
      return NextResponse.json({ testimonials: [] })
    }

    const testimonials = await db.websiteTestimonial.findMany({
      where: { isVisible: true },
      orderBy: { displayOrder: "asc" },
    })
    return NextResponse.json({ testimonials })
  } catch (error) {
    console.error("[Website API] Testimonials error:", error)
    return NextResponse.json({ error: "Failed to fetch testimonials" }, { status: 500 })
  }
}

export const revalidate = 3600
