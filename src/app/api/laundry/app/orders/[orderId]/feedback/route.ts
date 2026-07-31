// POST /api/laundry/app/orders/[orderId]/feedback — submit customer rating &
// feedback for a DELIVERED order. Ownership is enforced by the engine (order is
// looked up through the signed-in customer). Rating 1–5 is mandatory, the
// comment is optional, and only ONE submission per order is ever allowed.
import { NextResponse } from "next/server"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { submitOrderFeedback, sanitizeRating } from "@/lib/laundry-feedback"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { orderId } = await params
  const b = await request.json().catch(() => ({}))
  const rating = sanitizeRating(b.rating)
  if (rating === null) return NextResponse.json({ error: "Rating must be between 1 and 5 stars." }, { status: 400 })

  const r = await submitOrderFeedback({
    orderId,
    customerId: sess.customerId,
    rating,
    comment: typeof b.comment === "string" ? b.comment : "",
  })
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status })
  return NextResponse.json({ success: true, data: r.feedback }, { status: 201 })
}
