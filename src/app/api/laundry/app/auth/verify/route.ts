// POST /api/laundry/app/auth/verify — verify the EMAIL OTP and start a session
// (Phase 1). Reuses the platform storefront verify (createStorefrontSession) —
// the SAME session architecture as the rest of Quantix. For a new customer
// (otpPurpose "register") name + mobile are required and the customer is
// created + verified in this one step (no second OTP). Optional company is
// stored after the session is created.
//
// Body: { businessId, email, code, purpose?("login"|"register"), name?, mobile?, company? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { POST as storefrontVerify } from "@/app/api/core/storefront/auth/verify/route"
import { mergeMeta } from "@/lib/laundry-customer"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  if (!b.businessId || !b.email || !b.code) return NextResponse.json({ error: "businessId, email and code are required" }, { status: 400 })
  const purpose = b.purpose === "register" ? "register" : "login"

  const res = await storefrontVerify(new Request("http://internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    email: b.email, code: b.code, businessId: b.businessId, otpPurpose: purpose,
    ...(purpose === "register" ? { name: b.name, phone: b.mobile } : {}),
  }) }))
  const j = await res.json()
  if (!j.success) return NextResponse.json({ error: j.error || "Verification failed" }, { status: res.status })

  const session = j.data as { accessToken: string; customerId: string; user: { name: string } }
  // Optional company (registration) → customer metadata, once the customer exists.
  if (b.company && session.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: session.customerId }, select: { metadata: true } })
    await prisma.customer.update({ where: { id: session.customerId }, data: { metadata: mergeMeta(c?.metadata, { company: String(b.company) }) } }).catch(() => {})
  }
  return NextResponse.json({ success: true, data: { token: session.accessToken, customerId: session.customerId, name: session.user?.name } })
}
