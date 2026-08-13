import { NextResponse } from "next/server"
import { backfillGarScanCodes } from "@/lib/laundry-codes"
import { platformOnly } from "@/lib/platform-guard"

export const runtime = "nodejs"

export async function POST(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  try {
    const count = await backfillGarScanCodes()
    return NextResponse.json({ success: true, data: { backfilled: count } })
  } catch (e) {
    console.error("[gar-backfill] POST", e)
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 })
  }
}
