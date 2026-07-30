import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteTestimonial } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
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

    const data = {
      customerName: body.customerName,
      business: body.business || null,
      designation: body.designation || null,
      review: body.review,
      rating: body.rating ?? 5,
      photo: body.photo || null,
      isVisible: body.isVisible ?? true,
    }

    // Validate input
    const validation = validateWebsiteTestimonial(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get max displayOrder
    const maxOrder = await db.websiteTestimonial.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    })

    const testimonial = await db.websiteTestimonial.create({
      data: {
        ...data,
        displayOrder: (maxOrder?.displayOrder ?? 0) + 1,
      },
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "CREATE",
      resourceType: "WebsiteTestimonial",
      resourceId: testimonial.id,
      description: `Created new testimonial from ${testimonial.customerName}`,
      newValues: JSON.parse(JSON.stringify(testimonial)),
    })

    return NextResponse.json({ testimonial }, { status: 201 })
  }
)
