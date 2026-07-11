// POST /api/laundry/app/auth/send-otp — Customer App mobile OTP (Phase 1).
// Body: { businessId, mobile }
import { NextResponse } from "next/server"
import { requestOtp } from "@/lib/laundry-app-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    if (!b.businessId || !b.mobile) return NextResponse.json({ error: "businessId and mobile are required" }, { status: 400 })
    const res = await requestOtp(b.businessId, b.mobile)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    // devCode is only present when no SMS gateway is configured (dev/testing).
    return NextResponse.json({ success: true, data: { phone: res.phone, expiresInSec: res.expiresInSec, ...(res.devCode ? { devCode: res.devCode } : {}) } })
  } catch (e) {
    console.error("[app-auth-send-otp] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
