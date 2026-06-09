import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/api-middleware"
import { prisma } from "@/lib/prisma"

export const GET = withMiddleware({ requireAuth: true, requiredPermission: "website:view" })(
  async () => {
    let info = await prisma.websiteCompanyInfo.findUnique({ where: { id: "singleton" } })

    if (!info) {
      info = await prisma.websiteCompanyInfo.create({
        data: {
          id: "singleton",
          companyName: "Quantix Technology",
          websiteUrl: "https://quantixtechnology.in",
        },
      })
    }

    return NextResponse.json({ info })
  }
)

export const PATCH = withMiddleware({ requireAuth: true, requiredPermission: "website:configure" })(
  async (req) => {
    const body = await req.json()

    const allowed = [
      "companyName", "address", "contactNumber", "whatsappNumber",
      "supportEmail", "salesEmail", "websiteUrl",
      "gstNumber", "shopActNumber", "msmeNumber",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const info = await prisma.websiteCompanyInfo.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    })

    return NextResponse.json({ info })
  }
)
