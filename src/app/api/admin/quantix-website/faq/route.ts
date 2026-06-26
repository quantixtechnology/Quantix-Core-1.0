import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteFAQ } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    const faq = await db.websiteFAQ.findMany({
      orderBy: { sortOrder: "asc" },
    })

    return NextResponse.json({ faq })
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const data = {
      question: body.question,
      answer: body.answer,
      category: body.category || null,
      isVisible: body.isVisible ?? true,
    }

    // Validate input
    const validation = validateWebsiteFAQ(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get max sortOrder
    const maxOrder = await db.websiteFAQ.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })

    const item = await db.websiteFAQ.create({
      data: {
        ...data,
        sortOrder: (maxOrder?.sortOrder ?? 0) + 1,
        publishStatus: "DRAFT",
      },
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "CREATE",
      resourceType: "WebsiteFAQ",
      resourceId: item.id,
      description: `Created new FAQ: ${item.question.substring(0, 50)}`,
      newValues: JSON.parse(JSON.stringify(item)),
    })

    return NextResponse.json({ item }, { status: 201 })
  }
)
