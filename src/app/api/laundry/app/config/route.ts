// GET /api/laundry/app/config — public bootstrap for the Customer App: which
// laundry tenant this app talks to (name + platform businessId used for OTP).
// Single-tenant here; a multi-tenant deployment would resolve by hostname.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const lb = businessId
    ? await prisma.laundryBusiness.findFirst({ where: { OR: [{ id: businessId }, { platformBusinessId: businessId }] }, select: { platformBusinessId: true, businessName: true } })
    : await prisma.laundryBusiness.findFirst({ where: { platformBusinessId: { not: null } }, orderBy: { createdAt: "asc" }, select: { platformBusinessId: true, businessName: true } })
  if (!lb?.platformBusinessId) return NextResponse.json({ success: true, data: null })
  return NextResponse.json({ success: true, data: { businessId: lb.platformBusinessId, name: lb.businessName || "Laundry", currency: "INR" } })
}
