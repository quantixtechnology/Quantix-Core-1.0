import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    const body = await req.json()

    const allowed = ["customerName", "business", "designation", "review", "rating", "image", "displayOrder", "isVisible"]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const testimonial = await db.websiteTestimonial.update({
      where: { id },
      data,
    })

    return NextResponse.json({ testimonial })
  }
)

export const DELETE = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest, ctx?: Ctx) => {
    const params = await ctx?.params
    const id = params?.id as string | undefined
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    await db.websiteTestimonial.delete({ where: { id } })

    return NextResponse.json({ success: true })
  }
)
