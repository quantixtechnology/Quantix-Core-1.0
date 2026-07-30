import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
import { validateWebsiteCommunication } from "@/lib/website-validation"
import { logWebsiteAudit } from "@/lib/website-audit"
import type { NextRequest } from "next/server"

interface AuthenticatedRequest extends NextRequest {
  user?: { id: string; name: string; email: string; role: string }
}

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async (_req: AuthenticatedRequest) => {
    let comm = await db.websiteCommunication.findUnique({ where: { id: "singleton" } })

    if (!comm) {
      comm = await db.websiteCommunication.create({
        data: {
          id: "singleton",
          whatsappMessage: "Hello! How can we help?",
          whatsappFloatingBtn: true,
          whatsappBtnPosition: "bottom-right",
          whatsappDesktop: true,
          whatsappMobile: true,
          enableClickToCall: true,
          contactFormEnabled: true,
          socialLinks: "{}",
        },
      })
    }

    // Parse JSON fields
    const comm_data = {
      ...comm,
      socialLinks: JSON.parse(comm.socialLinks || "{}"),
    }

    return NextResponse.json({ communication: comm_data })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req: AuthenticatedRequest) => {
    const body = await req.json()

    const allowed = [
      "whatsappNumber", "whatsappMessage", "whatsappFloatingBtn", "whatsappBtnPosition",
      "whatsappDesktop", "whatsappMobile",
      "salesPhone", "supportPhone", "enableClickToCall",
      "salesEmail", "supportEmail", "contactFormRecipient",
      "contactFormEnabled", "contactFormSuccessMsg", "contactFormFailureMsg", "contactFormRedirectUrl",
      "socialLinks", "floatingButtonColor",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) {
        if (key === "socialLinks" && typeof body[key] === "object") {
          data[key] = JSON.stringify(body[key])
        } else {
          data[key] = body[key]
        }
      }
    }

    // Validate input
    const validation = validateWebsiteCommunication(data)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      )
    }

    // Get existing data for audit log
    const existing = await db.websiteCommunication.findUnique({ where: { id: "singleton" } })

    const comm = await db.websiteCommunication.upsert({
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
      resourceType: "WebsiteCommunication",
      resourceId: "singleton",
      description: `${existing ? "Updated" : "Created"} communication channels and contact information`,
      oldValues: existing ? JSON.parse(JSON.stringify(existing)) : undefined,
      newValues: JSON.parse(JSON.stringify(comm)),
    })

    const comm_data = {
      ...comm,
      socialLinks: JSON.parse(comm.socialLinks || "{}"),
    }

    return NextResponse.json({ communication: comm_data })
  }
)
