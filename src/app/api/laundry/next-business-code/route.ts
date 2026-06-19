import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET() {
  try {
    const now = new Date()
    const prefix = `LND-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`

    const last = await prisma.laundryBusiness.findFirst({
      where: { businessCode: { startsWith: prefix } },
      orderBy: { businessCode: "desc" },
      select: { businessCode: true },
    })

    let nextNumber = 1
    if (last) {
      const parts = last.businessCode.split("-")
      nextNumber = parseInt(parts[2], 10) + 1
    }

    const code = `${prefix}-${String(nextNumber).padStart(4, "0")}`
    return NextResponse.json({ code })
  } catch (error) {
    console.error("Error generating next business code:", error)
    return NextResponse.json({ error: "Failed to generate business code" }, { status: 500 })
  }
}
