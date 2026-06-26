import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { db } from "@/lib/db"
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
      "socialLinks",
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

    const comm = await db.websiteCommunication.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    const comm_data = {
      ...comm,
      socialLinks: JSON.parse(comm.socialLinks || "{}"),
    }

    return NextResponse.json({ communication: comm_data })
  }
)
