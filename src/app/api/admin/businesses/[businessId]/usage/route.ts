// GET /api/admin/businesses/[businessId]/usage — Super Admin quota visibility.
//
// Calls the SAME computeBusinessUsage() the tenant's Workspace Settings uses,
// so Quantix and the business can never be looking at different numbers. There
// is no second calculation here — this route only resolves the tenant and
// forwards the result.
import { NextResponse } from "next/server"
import { withPlatformAccess, createErrorResponse } from "@/lib/middleware"
import { prisma } from "@/lib/prisma"
import { computeBusinessUsage } from "@/lib/laundry-storage"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  return withPlatformAccess(async () => {
    try {
      const { businessId } = await params
      // Accept the platform Business id (what Super Admin screens hold).
      const laundry = await prisma.laundryBusiness.findFirst({
        where: { OR: [{ id: businessId }, { platformBusinessId: businessId }] },
        select: { id: true, platformBusinessId: true },
      })
      if (!laundry) return NextResponse.json({ success: true, data: null, reason: "Not a laundry workspace" })

      const usage = await computeBusinessUsage(laundry.id, laundry.platformBusinessId)
      return NextResponse.json({ success: true, data: usage })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : "Failed to compute usage", 500)
    }
  })(request)
}
