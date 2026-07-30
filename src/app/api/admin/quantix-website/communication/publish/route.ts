import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const POST = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const comm = await db.websiteCommunication.update({
      where: { id: "singleton" },
      data: {},
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: "PUBLISH",
      resourceType: "WebsiteCommunication",
      resourceId: "singleton",
      description: "Published communication channels to production",
      newValues: JSON.parse(JSON.stringify(comm)),
    })

    const comm_data = {
      ...comm,
      socialLinks: JSON.parse(comm.socialLinks || "{}"),
    }

    return NextResponse.json({ communication: comm_data })
  }
)
