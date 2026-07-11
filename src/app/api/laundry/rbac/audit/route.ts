// GET /api/laundry/rbac/audit?businessId= — the RBAC audit trail (append-only).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const guard = await requireLaundryPermission(businessId, "laundry.staff.view")
  if (!guard.ok) return guard.res
  const rows = await prisma.laundryAccessAudit.findMany({ where: { businessId: guard.platformBusinessId }, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({ success: true, data: rows.map((r) => ({ ...r, detail: (() => { try { return JSON.parse(r.detail) } catch { return {} } })() })) })
}
