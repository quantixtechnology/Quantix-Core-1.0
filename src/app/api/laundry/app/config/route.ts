// GET /api/laundry/app/config — public bootstrap for the Customer App: which
// laundry tenant this app talks to (name + platform businessId used for OTP)
// plus the tenant's Customer Service Number. Single-tenant here; a multi-tenant
// deployment would resolve by hostname. A missing number is valid (the PWA then
// simply hides the Customer Support block) — nothing here is ever hardcoded.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  const lb = businessId
    ? await prisma.laundryBusiness.findFirst({ where: { OR: [{ id: businessId }, { platformBusinessId: businessId }] }, select: { platformBusinessId: true, businessName: true } })
    : await prisma.laundryBusiness.findFirst({ where: { platformBusinessId: { not: null } }, orderBy: { createdAt: "asc" }, select: { platformBusinessId: true, businessName: true } })
  if (!lb?.platformBusinessId) return NextResponse.json({ success: true, data: null })

  // Customer Service Number comes from the SAME platform Business the app
  // already talks to — the tenant's own supportPhone, never a Quantix/hardcoded
  // number)SkipQuery. It rides the same row that decided businessId, so a
  // different tenant on this platform always gets its own number.
  const biz = await prisma.business.findFirst({ where: { id: lb.platformBusinessId }, select: { supportPhone: true } })

  return NextResponse.json({ success: true, data: { businessId: lb.platformBusinessId, name: lb.businessName || "Laundry", currency: "INR", supportPhone: biz?.supportPhone ?? null } })
}
