// POST /api/core/storefront/laundry-subscription/subscribe  — DEPRECATED
//
// This endpoint used to activate a subscription directly from a free-text
// name+phone mini-checkout. That is incorrect: a subscription purchase is a PAID
// transaction and must go through the existing customer auth + payment cycle.
// It now refuses to activate. Use instead:
//   POST /api/core/storefront/laundry-subscription/purchase          (authed)
//   POST /api/core/storefront/laundry-subscription/purchase/confirm  (authed, after verified payment)
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json({
    success: false,
    error: "This flow is deprecated. Subscriptions must be purchased through the authenticated customer checkout and verified payment.",
    use: "/api/core/storefront/laundry-subscription/purchase",
  }, { status: 410 })
}
