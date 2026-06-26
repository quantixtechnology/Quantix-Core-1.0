import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    const testimonials = await db.websiteTestimonial.findMany({
      orderBy: { displayOrder: "asc" },
    })

    return NextResponse.json({ testimonials })
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    // Get max displayOrder
    const maxOrder = await db.websiteTestimonial.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    })

    const testimonial = await db.websiteTestimonial.create({
      data: {
        customerName: body.customerName || "Customer Name",
        business: body.business || null,
        designation: body.designation || null,
        review: body.review || "Great product!",
        rating: body.rating ?? 5,
        image: body.image || null,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
        isVisible: body.isVisible ?? true,
      },
    })

    return NextResponse.json({ testimonial }, { status: 201 })
  }
)
