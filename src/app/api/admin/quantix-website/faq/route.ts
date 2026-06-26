import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
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

    // Get max sortOrder
    const maxOrder = await db.websiteFAQ.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })

    const item = await db.websiteFAQ.create({
      data: {
        question: body.question || "Question?",
        answer: body.answer || "Answer",
        category: body.category || null,
        sortOrder: (maxOrder?.sortOrder ?? 0) + 1,
        isVisible: body.isVisible ?? true,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  }
)
