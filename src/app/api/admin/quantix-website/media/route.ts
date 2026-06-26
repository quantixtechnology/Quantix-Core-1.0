import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (req: AuthenticatedRequest) => {
    const searchParams = new URL(req.url).searchParams
    const category = searchParams.get("category")

    const items = await db.websiteMedia.findMany({
      where: category ? { category } : {},
      orderBy: { uploadedAt: "desc" },
    })

    return NextResponse.json({ items })
  }
)

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const item = await db.websiteMedia.create({
      data: {
        fileName: body.fileName || "file",
        fileUrl: body.fileUrl || "",
        category: body.category || "general",
        fileType: body.fileType || "image",
        fileSize: body.fileSize || 0,
        altText: body.altText || null,
        description: body.description || null,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  }
)
