// POST /api/laundry/subscriptions/process-due
// Scheduled endpoint to process due subscriptions for all laundry businesses.
// Intended to be called by a daily cron (GitHub Actions / server cron).
// Secured by a shared secret (CRON_SECRET) in production.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processDueSubscriptions } from "@/lib/laundry-subscription-renewal"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    // Simple shared-secret auth for cron callers
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find all laundry businesses (platformBusinessId is the tenant scope for subscriptions)
    const businesses = await prisma.laundryBusiness.findMany({
      where: { platformBusinessId: { not: null } },
      select: { id: true, platformBusinessId: true, businessName: true },
    })

    const results: Array<{ businessId: string; businessName: string; processed: number; results: Array<{ id: string; action: string }>; error?: string }> = []

    for (const biz of businesses) {
      const platformId = biz.platformBusinessId!
      try {
        const result = await processDueSubscriptions(platformId, { actorName: "cron" })
        results.push({
          businessId: biz.id,
          businessName: biz.businessName,
          processed: result.processed,
          results: result.results,
        })
      } catch (e) {
        console.error(`[subscription-cron] Failed for business ${biz.id} (${biz.businessName}):`, e)
        results.push({
          businessId: biz.id,
          businessName: biz.businessName,
          processed: 0,
          results: [],
          error: e instanceof Error ? e.message : "Unknown error",
        })
      }
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0)
    return NextResponse.json({ success: true, totalProcessed, businesses: results })
  } catch (e) {
    console.error("[subscription-cron] Fatal error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}