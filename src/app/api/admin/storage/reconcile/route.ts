// POST /api/admin/storage/reconcile — backfill the FileUpload ledger.
//
// The reconciliation has always been a CLI script, and it stays one: this
// endpoint calls the SAME reconcileStorage() and adds nothing of its own. It
// exists because the upload directory lives on the production host, so the
// backfill has to be triggerable without a shell there.
//
// SAFETY
//   • QUANTIX_SUPER_ADMIN only — a tenant can never reach it.
//   • Read-only unless the body explicitly says { "apply": true }. A bare POST
//     is a dry run, so the dangerous mode cannot be reached by accident.
//   • Never deletes or modifies a file; inserts are deduped on uploadPath, so
//     running it twice cannot double-count storage.
//   • POST only — a GET could be triggered by a link or a prefetch.
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { reconcileStorage } from "@/lib/storage-reconcile"

export const runtime = "nodejs"
export const maxDuration = 300

const superAdminOnly = withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN"] })

export async function POST(request: NextRequest) {
  return superAdminOnly(async (req) => {
    try {
      // A malformed or absent body is a dry run, never an apply.
      let apply = false
      try {
        const body = await req.json()
        apply = body?.apply === true
      } catch { /* no body — dry run */ }

      const report = await reconcileStorage({ apply })
      return NextResponse.json({ success: true, data: report })
    } catch (error) {
      console.error("[storage-reconcile] failed", error)
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Reconciliation failed" },
        { status: 500 },
      )
    }
  })(request)
}
