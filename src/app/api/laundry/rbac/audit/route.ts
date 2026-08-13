import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryAnyLevel, Level } from "@/lib/laundry-rbac"
import { ROLE_READ_SCREENS } from "@/lib/laundry-rbac-screens"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryAnyLevel(request, businessId, ROLE_READ_SCREENS, Level.VIEW)
  if (!guard.ok) return guard.res
  const rows = await prisma.laundryAccessAudit.findMany({ where: { businessId: guard.platformBusinessId }, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({ success: true, data: rows })
}
