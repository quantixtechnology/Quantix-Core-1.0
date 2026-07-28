import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryLevel(request, businessId, "laundry.staff", Level.VIEW)
  if (!guard.ok) return guard.res
  const rows = await prisma.laundryAccessAudit.findMany({ where: { businessId: guard.platformBusinessId }, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({ success: true, data: rows })
}
