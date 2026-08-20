// GET /api/admin/audit/tenants — read-only tenant reconciliation.
//
// Reports what exists; changes nothing. There is no POST, PUT or DELETE here on
// purpose: this endpoint answers "what is in the database", and the decision to
// act on the answer is a separate, deliberate step.
//
// QUANTIX_SUPER_ADMIN only — it exposes the full tenant inventory.
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { auditTenants } from "@/lib/tenant-audit"
import { reconcileStorage } from "@/lib/storage-reconcile"

export const runtime = "nodejs"
export const maxDuration = 300

const superAdminOnly = withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN"] })

export async function GET(request: NextRequest) {
  return superAdminOnly(async (req) => {
    try {
      const includeDisk = new URL(req.url).searchParams.get("disk") === "1"
      const audit = await auditTenants()
      // The disk scan is the same read-only walk the reconciler does; it never
      // writes because apply is not passed.
      const disk = includeDisk ? await reconcileStorage() : null
      return NextResponse.json({ success: true, data: { ...audit, disk } })
    } catch (error) {
      console.error("[tenant-audit] failed", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Audit failed" },
        { status: 500 },
      )
    }
  })(request)
}
