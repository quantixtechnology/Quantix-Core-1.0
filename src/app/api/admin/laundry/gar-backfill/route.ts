import { NextResponse } from "next/server"
import { backfillGarScanCodes } from "@/lib/laundry-codes"

export const runtime = "nodejs"

export async function POST() {
  try {
    const count = await backfillGarScanCodes()
    return NextResponse.json({ success: true, data: { backfilled: count } })
  } catch (e) {
    console.error("[gar-backfill] POST", e)
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 })
  }
}
