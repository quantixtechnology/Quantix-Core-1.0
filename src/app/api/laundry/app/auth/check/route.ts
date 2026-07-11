// POST /api/laundry/app/auth/check — does an account exist for this email?
// Reuses the platform storefront customer-existence check (no duplicate logic).
// Body: { businessId, email }
import { NextResponse } from "next/server"
import { POST as storefrontCheck } from "@/app/api/core/storefront/auth/check-customer/route"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const res = await storefrontCheck(new Request("http://internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: b.email, businessId: b.businessId }) }))
  const j = await res.json()
  if (!j.success) return NextResponse.json({ error: j.error || "Check failed" }, { status: res.status })
  return NextResponse.json({ success: true, data: { exists: !!j.exists } })
}
