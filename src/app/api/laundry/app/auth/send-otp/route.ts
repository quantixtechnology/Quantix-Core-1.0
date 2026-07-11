// POST /api/laundry/app/auth/send-otp — send an EMAIL OTP (Phase 1).
// Reuses the platform storefront email-OTP service (no separate OTP logic, no
// SMS). Body: { businessId, email }
import { NextResponse } from "next/server"
import { POST as storefrontSendOtp } from "@/app/api/core/storefront/auth/send-otp/route"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  if (!b.businessId || !b.email) return NextResponse.json({ error: "businessId and email are required" }, { status: 400 })
  const res = await storefrontSendOtp(new Request("http://internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: b.email, businessId: b.businessId }) }))
  const j = await res.json()
  if (!j.success) return NextResponse.json({ error: j.error || "Failed to send code" }, { status: res.status })
  return NextResponse.json({ success: true, data: { sent: j.sent } })
}
