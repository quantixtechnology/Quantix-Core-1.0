// POST /api/laundry/app/auth/verify — verify OTP → session token (Phase 1).
// Body: { businessId, mobile, code, device? }
import { NextResponse } from "next/server"
import { verifyOtp } from "@/lib/laundry-app-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    if (!b.businessId || !b.mobile || !b.code) return NextResponse.json({ error: "businessId, mobile and code are required" }, { status: 400 })
    const res = await verifyOtp(b.businessId, b.mobile, String(b.code), b.device || request.headers.get("user-agent"))
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 401 })
    return NextResponse.json({ success: true, data: { token: res.token, customerId: res.customerId, businessId: res.businessId, needsProfile: res.needsProfile } })
  } catch (e) {
    console.error("[app-auth-verify] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
