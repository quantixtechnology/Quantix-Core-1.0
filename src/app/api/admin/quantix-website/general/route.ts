import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteGeneral } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let general = await db.websiteGeneral.findUnique({ where: { id: "singleton" } })

    if (!general) {
      general = await db.websiteGeneral.create({
        data: {
          id: "singleton",
          websiteName: "Quantix",
          defaultLanguage: "en-IN",
          timezone: "Asia/Kolkata",
        },
      })
    }

    return NextResponse.json({ general })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "websiteName", "websiteUrl", "defaultLanguage", "timezone",
      "companyEmail", "supportEmail", "salesPhone", "supportPhone",
      "copyright", "websiteStatus", "maintenanceMode", "maintenanceMessage",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    // Validate input
    const validation = validateWebsiteGeneral(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get existing data for audit log
    const existing = await db.websiteGeneral.findUnique({ where: { id: "singleton" } })

    const general = await db.websiteGeneral.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    // Log audit
    await logWebsiteAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
      action: existing ? "UPDATE" : "CREATE",
      resourceType: "WebsiteGeneral",
      resourceId: "singleton",
      description: `${existing ? "Updated" : "Created"} general website settings`,
      oldValues: existing ? JSON.parse(JSON.stringify(existing)) : undefined,
      newValues: JSON.parse(JSON.stringify(general)),
    })

    return NextResponse.json({ general })
  }
)
