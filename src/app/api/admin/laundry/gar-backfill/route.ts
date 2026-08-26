// GAR repair endpoint — platform staff only.
//
//   GET  ?businessId=&orderId=   → READ-ONLY audit of the scoped population
//   POST { businessId | orderId | itemIds | all:true } → backfill that scope
//
// POST refuses to run unscoped unless `all: true` is passed explicitly. A GAR
// repair rewrites printed identities, so "which tenant" is never a default.
import { NextResponse } from "next/server"
import { auditGarScanCodes, backfillGarScanCodes, type GarScope } from "@/lib/laundry-codes"
import { platformOnly } from "@/lib/platform-guard"

export const runtime = "nodejs"

function scopeFrom(src: { businessId?: unknown; orderId?: unknown; itemIds?: unknown }): GarScope {
  return {
    businessId: typeof src.businessId === "string" && src.businessId ? src.businessId : null,
    orderId: typeof src.orderId === "string" && src.orderId ? src.orderId : null,
    itemIds: Array.isArray(src.itemIds) ? src.itemIds.filter((v): v is string => typeof v === "string") : null,
  }
}

const isScoped = (s: GarScope) => !!(s.businessId || s.orderId || (s.itemIds && s.itemIds.length))

export async function GET(request: Request) {
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  try {
    const u = new URL(request.url)
    const scope = scopeFrom({ businessId: u.searchParams.get("businessId"), orderId: u.searchParams.get("orderId") })
    const report = await auditGarScanCodes(scope)
    return NextResponse.json({ success: true, scope, data: report })
  } catch (e) {
    console.error("[gar-backfill] GET", e)
    return NextResponse.json({ error: "Audit failed" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  try {
    const b = await request.json().catch(() => ({}))
    const scope = scopeFrom(b)
    if (!isScoped(scope) && b.all !== true) {
      return NextResponse.json(
        { error: "Refusing to backfill every tenant. Pass businessId, orderId or itemIds — or all:true to mean it.", code: "SCOPE_REQUIRED" },
        { status: 400 },
      )
    }
    // Baseline, repair, prove — all three in one response so the operator never
    // has to trust the write without seeing the before/after.
    const before = await auditGarScanCodes(scope)
    const result = await backfillGarScanCodes({ scope })
    const after = await auditGarScanCodes(scope)
    return NextResponse.json({ success: true, scope, data: { before, result, after } })
  } catch (e) {
    console.error("[gar-backfill] POST", e)
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 })
  }
}
